"""Administrative endpoints for bootstrapping the database."""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .. import models, schemas, utils
from ..auth import SupabaseSession, require_roles
from ..database import ASYNC_ENGINE, get_session

router = APIRouter(prefix="/api/admin", tags=["admin"])

_REPO_ROOT = Path(__file__).resolve().parents[3]
_SCHEMA_PATH = _REPO_ROOT / "db" / "schema.sql"
_DEMO_DATA_PATH = _REPO_ROOT / "db" / "demo_seed_data.json"

_ROLE_PRIORITY = {"owner": 0, "admin": 1, "viewer": 2}


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


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "org"


def _duration_hours(value: Optional[timedelta]) -> int:
    if value is None:
        return 0
    return int(value.total_seconds() // 3600)


async def _fetch_org(
    session: AsyncSession, org_id: Optional[uuid.UUID] = None
) -> models.Org:
    query = (
        select(models.Org)
        .options(
            selectinload(models.Org.members).selectinload(models.OrgMember.user),
            selectinload(models.Org.seeds),
        )
        .order_by(models.Org.created_at)
    )

    if org_id is not None:
        query = query.where(models.Org.id == org_id)
    else:
        query = query.limit(1)

    result = await session.execute(query)
    org = result.scalar_one_or_none()
    if org is None:
        detail = "Organization not found" if org_id is not None else "No organizations available"
        raise HTTPException(status_code=404, detail=detail)
    return org


async def _build_admin_overview(
    session: AsyncSession, org: models.Org
) -> schemas.AdminOrgOverview:
    assessments_result = await session.execute(
        select(models.Assessment)
        .options(
            selectinload(models.Assessment.invitations).selectinload(
                models.Invitation.candidate_repo
            ),
            selectinload(models.Assessment.seed),
        )
        .where(models.Assessment.org_id == org.id)
        .order_by(models.Assessment.created_at.desc())
    )
    assessments = assessments_result.scalars().all()

    invitations: list[models.Invitation] = []
    candidate_repos: list[models.CandidateRepo] = []
    for assessment in assessments:
        sorted_invites = sorted(
            assessment.invitations, key=lambda invite: invite.sent_at, reverse=True
        )
        invitations.extend(sorted_invites)
        for invite in sorted_invites:
            if invite.candidate_repo is not None:
                candidate_repos.append(invite.candidate_repo)

    invitation_ids = [invite.id for invite in invitations]
    if invitation_ids:
        review_comments_result = await session.execute(
            select(models.ReviewComment)
            .where(models.ReviewComment.invitation_id.in_(invitation_ids))
            .order_by(models.ReviewComment.created_at.desc())
        )
        review_comments = review_comments_result.scalars().all()
    else:
        review_comments = []

    author_ids = {comment.created_by for comment in review_comments if comment.created_by}
    if author_ids:
        users_result = await session.execute(
            select(models.User).where(models.User.id.in_(author_ids))
        )
        user_map = {user.id: user for user in users_result.scalars()}
    else:
        user_map = {}

    templates_result = await session.execute(
        select(models.EmailTemplate)
        .where(models.EmailTemplate.org_id == org.id)
        .order_by(models.EmailTemplate.created_at.desc())
    )
    templates = templates_result.scalars().all()

    memberships = sorted(
        org.members,
        key=lambda member: (_ROLE_PRIORITY.get(member.role, 99), member.created_at),
    )
    current_admin: Optional[schemas.AdminUser] = None
    for membership in memberships:
        if membership.user is None:
            continue
        user = membership.user
        current_admin = schemas.AdminUser(
            id=str(user.id),
            email=user.email,
            name=user.name or user.email,
            role=membership.role,
        )
        break

    seeds = sorted(org.seeds, key=lambda seed: seed.created_at, reverse=True)

    return schemas.AdminOrgOverview(
        org=schemas.AdminOrg(id=str(org.id), name=org.name, slug=_slugify(org.name)),
        current_admin=current_admin,
        seeds=[
            schemas.AdminSeed(
                id=str(seed.id),
                source_repo_url=seed.source_repo_url,
                seed_repo=seed.seed_repo_full_name,
                latest_main_sha=seed.latest_main_sha,
                created_at=seed.created_at,
            )
            for seed in seeds
        ],
        assessments=[
            schemas.AdminAssessment(
                id=str(assessment.id),
                org_id=str(assessment.org_id),
                seed_id=str(assessment.seed_id),
                title=assessment.title,
                description=assessment.description,
                instructions=assessment.instructions,
                candidate_email_subject=assessment.candidate_email_subject,
                candidate_email_body=assessment.candidate_email_body,
                time_to_start_hours=_duration_hours(assessment.time_to_start),
                time_to_complete_hours=_duration_hours(assessment.time_to_complete),
                created_by=str(assessment.created_by)
                if assessment.created_by is not None
                else None,
                created_at=assessment.created_at,
            )
            for assessment in assessments
        ],
        invitations=[
            schemas.AdminInvitation(
                id=str(invitation.id),
                assessment_id=str(invitation.assessment_id),
                candidate_email=invitation.candidate_email,
                candidate_name=invitation.candidate_name,
                status=invitation.status.value,
                start_deadline=invitation.start_deadline,
                complete_deadline=invitation.complete_deadline,
                start_link_token=None,
                sent_at=invitation.sent_at,
                started_at=invitation.started_at,
                submitted_at=invitation.submitted_at,
            )
            for invitation in invitations
        ],
        candidate_repos=[
            schemas.AdminCandidateRepo(
                id=str(repo.id),
                invitation_id=str(repo.invitation_id),
                seed_sha_pinned=repo.seed_sha_pinned,
                repo_full_name=repo.repo_full_name,
                repo_html_url=repo.repo_html_url,
                started_at=repo.created_at,
                last_commit_at=None,
            )
            for repo in sorted(candidate_repos, key=lambda repo: repo.created_at, reverse=True)
        ],
        review_comments=[
            schemas.AdminReviewComment(
                id=str(comment.id),
                invitation_id=str(comment.invitation_id),
                author=(
                    user_map[comment.created_by].name
                    if comment.created_by in user_map and user_map[comment.created_by].name
                    else (
                        user_map[comment.created_by].email
                        if comment.created_by in user_map
                        else None
                    )
                ),
                body=comment.body,
                created_at=comment.created_at,
            )
            for comment in review_comments
        ],
        email_templates=[
            schemas.AdminEmailTemplate(
                id=str(template.id),
                org_id=str(template.org_id),
                name=template.key or (template.subject or "Template"),
                subject=template.subject,
                body=template.body,
                description="",
                updated_at=template.created_at,
            )
            for template in templates
        ],
    )


@router.get("/demo-overview", response_model=schemas.AdminOrgOverview)
async def get_demo_overview(
    session: AsyncSession = Depends(get_session),
) -> schemas.AdminOrgOverview:
    """Return a consolidated snapshot of the first organization for demos."""

    org = await _fetch_org(session)
    return await _build_admin_overview(session, org)
