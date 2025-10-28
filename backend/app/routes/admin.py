"""Administrative endpoints for bootstrapping the database."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas, utils
from ..auth import SupabaseSession, require_roles
from ..database import ASYNC_ENGINE, get_session

router = APIRouter(prefix="/api/admin", tags=["admin"])

_REPO_ROOT = Path(__file__).resolve().parents[3]
_SCHEMA_PATH = _REPO_ROOT / "db" / "schema.sql"
_DEMO_DATA_PATH = _REPO_ROOT / "db" / "demo_seed_data.json"


async def _apply_schema() -> int:
    """Execute the schema SQL file against the connected database."""

    try:
        schema_sql = _SCHEMA_PATH.read_text(encoding="utf-8")
    except FileNotFoundError as exc:  # pragma: no cover - developer misconfiguration
        raise HTTPException(status_code=500, detail="Database schema file not found") from exc

    if not schema_sql.strip():
        return 0

    statements = [stmt.strip() for stmt in schema_sql.split(";") if stmt.strip()]

    if not statements:
        return 0

    async with ASYNC_ENGINE.begin() as conn:
        for statement in statements:
            await conn.exec_driver_sql(statement)

    return len(schema_sql)


def _load_demo_data() -> dict:
    """Load demo seed configuration from the repository JSON file."""

    try:
        payload = _DEMO_DATA_PATH.read_text(encoding="utf-8")
    except FileNotFoundError as exc:  # pragma: no cover - developer misconfiguration
        raise HTTPException(status_code=500, detail="Demo data file not found") from exc

    try:
        data = json.loads(payload)
    except json.JSONDecodeError as exc:  # pragma: no cover - developer misconfiguration
        raise HTTPException(status_code=500, detail="Demo data file is invalid JSON") from exc

    return data


async def _seed_demo_data(session: AsyncSession) -> schemas.SeedSummary:
    """Seed a minimal organization, user, and assessment if absent."""

    demo_data = _load_demo_data()

    org_config = demo_data.get("org", {})
    seed_config = demo_data.get("seed", {})
    assessment_config = demo_data.get("assessment", {})
    invitation_config = demo_data.get("invitation", {})

    demo_org_name = org_config.get("name", "Demo Assessment Org")
    members = org_config.get("members", [])
    owner_config = next((member for member in members if member.get("role") == "owner"), None)
    if owner_config is None and members:
        owner_config = members[0]

    demo_user_email = (owner_config or {}).get("email", "founder@example.com")
    demo_user_name = (owner_config or {}).get("name", "Demo Founder")

    demo_seed_repo = seed_config.get("seed_repo_full_name", "example/fullstack-seed")
    demo_source_repo = seed_config.get("source_repo_url", "https://github.com/example/fullstack-seed")
    demo_default_branch = seed_config.get("default_branch", "main")
    demo_is_template = seed_config.get("is_template", True)
    demo_latest_main_sha = seed_config.get("latest_main_sha")

    demo_assessment_title = assessment_config.get("title", "Full Stack Product Challenge")
    demo_assessment_description = assessment_config.get(
        "description", "Build an end-to-end feature using the provided template."
    )
    demo_instructions = assessment_config.get(
        "instructions", "Follow the README in the generated repository to get started."
    )
    demo_candidate_email_subject = assessment_config.get(
        "candidate_email_subject", "Your interview project is ready"
    )
    demo_candidate_email_body = assessment_config.get(
        "candidate_email_body", "Welcome! Clone the repo and submit within 48 hours."
    )
    demo_time_to_start = timedelta(hours=assessment_config.get("time_to_start_hours", 72))
    demo_time_to_complete = timedelta(hours=assessment_config.get("time_to_complete_hours", 48))

    demo_candidate_email = invitation_config.get("candidate_email", "candidate@example.com")
    demo_candidate_name = invitation_config.get("candidate_name", "Demo Candidate")

    created_org = False
    created_user = False
    created_membership = False
    created_seed = False
    created_assessment = False
    created_invitation = False
    invitation_start_token: Optional[str] = None

    org_result = await session.execute(select(models.Org).where(models.Org.name == demo_org_name))
    org = org_result.scalar_one_or_none()
    if org is None:
        org = models.Org(name=demo_org_name)
        session.add(org)
        await session.flush()
        created_org = True

    user_result = await session.execute(select(models.User).where(models.User.email == demo_user_email))
    user = user_result.scalar_one_or_none()
    if user is None:
        user = models.User(email=demo_user_email, name=demo_user_name)
        session.add(user)
        await session.flush()
        created_user = True

    membership_result = await session.execute(
        select(models.OrgMember).where(
            models.OrgMember.org_id == org.id, models.OrgMember.user_id == user.id
        )
    )
    membership = membership_result.scalar_one_or_none()
    if membership is None:
        membership = models.OrgMember(org_id=org.id, user_id=user.id, role="owner")
        session.add(membership)
        created_membership = True

    seed_result = await session.execute(
        select(models.Seed).where(
            models.Seed.org_id == org.id,
            models.Seed.seed_repo_full_name == demo_seed_repo,
        )
    )
    seed = seed_result.scalar_one_or_none()
    if seed is None:
        seed = models.Seed(
            org_id=org.id,
            source_repo_url=demo_source_repo,
            seed_repo_full_name=demo_seed_repo,
            default_branch=demo_default_branch,
            is_template=demo_is_template,
            latest_main_sha=demo_latest_main_sha,
        )
        session.add(seed)
        await session.flush()
        created_seed = True

    assessment_result = await session.execute(
        select(models.Assessment).where(
            models.Assessment.org_id == org.id,
            models.Assessment.title == demo_assessment_title,
        )
    )
    assessment = assessment_result.scalar_one_or_none()
    if assessment is None:
        assessment = models.Assessment(
            org_id=org.id,
            seed_id=seed.id,
            title=demo_assessment_title,
            description=demo_assessment_description,
            instructions=demo_instructions,
            candidate_email_subject=demo_candidate_email_subject,
            candidate_email_body=demo_candidate_email_body,
            time_to_start=demo_time_to_start,
            time_to_complete=demo_time_to_complete,
            created_by=user.id,
        )
        session.add(assessment)
        await session.flush()
        created_assessment = True

    invitation_result = await session.execute(
        select(models.Invitation).where(
            models.Invitation.assessment_id == assessment.id,
            models.Invitation.candidate_email == demo_candidate_email,
        )
    )
    invitation = invitation_result.scalar_one_or_none()
    if invitation is None:
        raw_token = utils.generate_token()
        now = datetime.now(timezone.utc)
        start_deadline = now + demo_time_to_start
        complete_deadline = start_deadline + demo_time_to_complete
        invitation = models.Invitation(
            assessment_id=assessment.id,
            candidate_email=demo_candidate_email,
            candidate_name=demo_candidate_name,
            start_link_token_hash=utils.hash_token(raw_token),
            start_deadline=start_deadline,
            complete_deadline=complete_deadline,
        )
        session.add(invitation)
        await session.flush()
        invitation_start_token = raw_token
        created_invitation = True

    await session.commit()

    return schemas.SeedSummary(
        created_org=created_org,
        org_id=str(org.id),
        created_user=created_user,
        user_id=str(user.id),
        created_membership=created_membership,
        created_seed=created_seed,
        seed_id=str(seed.id),
        created_assessment=created_assessment,
        assessment_id=str(assessment.id),
        created_invitation=created_invitation,
        invitation_id=str(invitation.id),
        invitation_start_token=invitation_start_token,
    )


@router.post("/bootstrap", response_model=schemas.BootstrapResponse)
async def bootstrap_database(
    session: AsyncSession = Depends(get_session),
    current_session: SupabaseSession = Depends(require_roles("service_role", "admin")),
) -> schemas.BootstrapResponse:
    """Apply database schema migrations and seed initial demo data."""

    applied_bytes = await _apply_schema()
    seed_summary = await _seed_demo_data(session)

    return schemas.BootstrapResponse(
        migrated=applied_bytes > 0,
        schema_path=str(_SCHEMA_PATH),
        seed=seed_summary,
    )
