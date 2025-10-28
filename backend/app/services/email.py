"""Email sending helpers backed by Resend."""

from __future__ import annotations

import html
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from typing import Mapping, Optional

import httpx
from dotenv import find_dotenv, load_dotenv
from pydantic import Field, ValidationError
from pydantic_settings import BaseSettings
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models

logger = logging.getLogger(__name__)

_DOTENV_PATH = find_dotenv(filename=".env", raise_error_if_not_found=False, usecwd=True)
if _DOTENV_PATH:
    load_dotenv(_DOTENV_PATH)


class ResendSettings(BaseSettings):
    """Configuration required to send transactional email via Resend."""

    api_key: str = Field(..., env="RESEND_API_KEY")
    from_email: str = Field(..., env="RESEND_FROM_EMAIL")
    from_name: Optional[str] = Field(None, env="RESEND_FROM_NAME")
    reply_to_email: Optional[str] = Field(None, env="RESEND_REPLY_TO_EMAIL")
    candidate_app_url: str = Field(..., env="CANDIDATE_APP_URL")
    api_base_url: str = Field("https://api.resend.com", env="RESEND_API_BASE_URL")
    request_timeout_seconds: float = Field(10.0, env="RESEND_HTTP_TIMEOUT_SECONDS")

    @property
    def normalized_candidate_base(self) -> str:
        return self.candidate_app_url.rstrip("/")


@lru_cache
def get_resend_settings() -> ResendSettings:
    try:
        return ResendSettings()
    except ValidationError as exc:  # pragma: no cover - configuration error
        raise RuntimeError("Resend environment variables are not configured") from exc


class EmailServiceError(RuntimeError):
    """Raised when an email could not be delivered."""


@dataclass(slots=True)
class InvitationEmailPayload:
    invitation: models.Invitation
    assessment: models.Assessment
    start_link_token: str


class ResendEmailService:
    """Send candidate emails through Resend."""

    def __init__(self, settings: ResendSettings) -> None:
        self._settings = settings

    def _build_from_header(self) -> str:
        if self._settings.from_name:
            return f"{self._settings.from_name} <{self._settings.from_email}>"
        return self._settings.from_email

    def _build_start_link(self, token: str) -> str:
        base = self._settings.normalized_candidate_base
        return f"{base}/candidates/{token}"

    def _render_template(
        self,
        template: Optional[str],
        context: Mapping[str, str],
        *,
        default: str,
        include_start_link_fallback: bool = False,
    ) -> str:
        if not template:
            template = default
        rendered = template
        for key, value in context.items():
            rendered = rendered.replace(f"{{{{{key}}}}}", value)
        if include_start_link_fallback and "{{start_link}}" not in template and context.get("start_link"):
            rendered = f"{rendered}\n\nStart your project: {context['start_link']}"
        return rendered

    def _build_email_content(
        self, payload: InvitationEmailPayload
    ) -> tuple[str, str, str]:
        invitation = payload.invitation
        assessment = payload.assessment
        start_link = self._build_start_link(payload.start_link_token)

        subject_default = "Your coding interview project is ready"
        body_default = (
            "Hi {{candidate_name}},\n\n"
            "Your project for {{assessment_title}} is ready. "
            "Use the link below to get started and remember to submit before the deadline.\n\n"
            "{{start_link}}\n"
        )

        context: Mapping[str, str] = {
            "candidate_name": invitation.candidate_name or invitation.candidate_email,
            "candidate_email": invitation.candidate_email,
            "assessment_title": assessment.title,
            "start_link": start_link,
        }

        subject_template = assessment.candidate_email_subject or subject_default
        subject = self._render_template(
            subject_template, context, default=subject_default, include_start_link_fallback=False
        )

        body_template = assessment.candidate_email_body or body_default
        text_body = self._render_template(
            body_template,
            context,
            default=body_default,
            include_start_link_fallback=True,
        )

        html_body = "<br>".join(html.escape(part) for part in text_body.split("\n"))
        return subject.strip(), text_body.strip(), html_body

    async def send_invitation_email(
        self,
        session: AsyncSession,
        payload: InvitationEmailPayload,
    ) -> None:
        subject, text_body, html_body = self._build_email_content(payload)
        invitation = payload.invitation

        headers = {
            "Authorization": f"Bearer {self._settings.api_key}",
            "Content-Type": "application/json",
        }
        json_payload: dict[str, object] = {
            "from": self._build_from_header(),
            "to": [invitation.candidate_email],
            "subject": subject,
            "text": text_body,
            "html": html_body,
        }
        if self._settings.reply_to_email:
            json_payload["reply_to"] = [self._settings.reply_to_email]

        async with httpx.AsyncClient(
            base_url=self._settings.api_base_url,
            timeout=self._settings.request_timeout_seconds,
        ) as client:
            response = await client.post("/emails", json=json_payload, headers=headers)
        if response.status_code >= 400:
            detail = response.text
            logger.error("Resend failed to send invitation email: %s", detail)
            raise EmailServiceError(
                f"Resend returned {response.status_code} while sending invitation email"
            )

        data = response.json()
        provider_id = str(data.get("id")) if data.get("id") is not None else None

        invitation.sent_at = datetime.now(timezone.utc)

        email_event = models.EmailEvent(
            invitation_id=invitation.id,
            type=models.EmailEventType.invite,
            provider_id=provider_id,
            to_email=invitation.candidate_email,
            status=data.get("status") if isinstance(data.get("status"), str) else "sent",
        )
        session.add(email_event)
        await session.flush()


@lru_cache
def get_resend_email_service() -> ResendEmailService:
    return ResendEmailService(get_resend_settings())
