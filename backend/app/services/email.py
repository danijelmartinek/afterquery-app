"""Email sending helpers backed by Resend."""

from __future__ import annotations

import html
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from typing import Mapping, Optional, Sequence

import httpx
from dotenv import find_dotenv, load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models

logger = logging.getLogger(__name__)

_DOTENV_PATH = find_dotenv(filename=".env", raise_error_if_not_found=False, usecwd=True)
if _DOTENV_PATH:
    load_dotenv(_DOTENV_PATH)


@dataclass(frozen=True, slots=True)
class ResendSettings:
    """Configuration required to send transactional email via Resend."""

    api_key: str
    from_email: str
    candidate_app_url: str
    from_name: Optional[str] = None
    reply_to_email: Optional[str] = None
    api_base_url: str = "https://api.resend.com"
    request_timeout_seconds: float = 10.0

    @property
    def normalized_candidate_base(self) -> str:
        return self.candidate_app_url.rstrip("/")


_REQUIRED_ENVIRONMENT_KEYS: Mapping[str, Sequence[str]] = {
    "api_key": ("RESEND_API_KEY",),
    "from_email": ("RESEND_FROM_EMAIL",),
    "candidate_app_url": ("CANDIDATE_APP_URL", "NEXT_PUBLIC_CANDIDATE_APP_URL"),
}

_OPTIONAL_ENVIRONMENT_KEYS: Mapping[str, Sequence[str]] = {
    "from_name": ("RESEND_FROM_NAME",),
    "reply_to_email": ("RESEND_REPLY_TO_EMAIL",),
    "api_base_url": ("RESEND_API_BASE_URL",),
    "request_timeout_seconds": ("RESEND_HTTP_TIMEOUT_SECONDS",),
}


def _read_first_env(names: Sequence[str]) -> Optional[str]:
    for env_name in names:
        value = os.getenv(env_name)
        if value is not None and value.strip() != "":
            return value
    return None


def _build_missing_env_message(missing: list[str]) -> str:
    detail = "Resend environment variables are not configured"
    if missing:
        detail = f"{detail}: missing {', '.join(missing)}"
    return detail


@lru_cache
def get_resend_settings() -> ResendSettings:
    values: dict[str, str] = {}
    missing: list[str] = []

    for field_name, env_names in _REQUIRED_ENVIRONMENT_KEYS.items():
        value = _read_first_env(env_names)
        if value is None:
            missing.append(" or ".join(env_names))
            continue
        values[field_name] = value

    if missing:  # pragma: no cover - configuration error
        raise RuntimeError(_build_missing_env_message(missing))

    for field_name, env_names in _OPTIONAL_ENVIRONMENT_KEYS.items():
        value = _read_first_env(env_names)
        if value is not None:
            values[field_name] = value

    api_base_url = values.get("api_base_url", "https://api.resend.com")

    timeout_value = values.get("request_timeout_seconds")
    request_timeout = 10.0
    if timeout_value is not None:
        try:
            request_timeout = float(timeout_value)
        except ValueError as exc:  # pragma: no cover - configuration error
            raise RuntimeError(
                "Resend environment variables are not configured:"
                " RESEND_HTTP_TIMEOUT_SECONDS must be a number"
            ) from exc

    return ResendSettings(
        api_key=values["api_key"],
        from_email=values["from_email"],
        candidate_app_url=values["candidate_app_url"],
        from_name=values.get("from_name"),
        reply_to_email=values.get("reply_to_email"),
        api_base_url=api_base_url,
        request_timeout_seconds=request_timeout,
    )


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
            for placeholder in (f"{{{{{key}}}}}", f"{{{key}}}"):
                rendered = rendered.replace(placeholder, value)
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

        def _format_deadline(value: Optional[datetime]) -> Optional[str]:
            if value is None:
                return None
            return value.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M %Z")

        context: dict[str, str] = {
            "candidate_name": invitation.candidate_name or invitation.candidate_email,
            "candidate_email": invitation.candidate_email,
            "assessment_title": assessment.title,
            "start_link": start_link,
        }

        optional_context = {
            "start_deadline": _format_deadline(invitation.start_deadline),
            "complete_deadline": _format_deadline(invitation.complete_deadline),
        }
        for key, value in optional_context.items():
            if value is not None:
                context[key] = value

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
