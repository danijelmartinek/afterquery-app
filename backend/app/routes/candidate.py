"""Candidate-facing endpoints for start and submit flows."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .. import models, schemas
from ..database import get_session
from ..utils import generate_token, hash_token

router = APIRouter(prefix="/api", tags=["candidate"])


async def _get_invitation_by_token(
    session: AsyncSession, token: str
) -> models.Invitation:
    hashed = hash_token(token)
    result = await session.execute(
        select(models.Invitation)
        .options(
            selectinload(models.Invitation.assessment).selectinload(models.Assessment.seed),
            selectinload(models.Invitation.candidate_repo),
            selectinload(models.Invitation.access_tokens),
        )
        .where(models.Invitation.start_link_token_hash == hashed)
    )
    invitation = result.scalar_one_or_none()
    if invitation is None:
        raise HTTPException(status_code=404, detail="Invitation not found")
    return invitation


def _duration_hours(value: timedelta | None) -> int:
    if value is None:
        return 0
    return int(value.total_seconds() // 3600)


@router.get("/start/{token}", response_model=schemas.CandidateStartData)
async def get_invitation_details(
    token: str, session: AsyncSession = Depends(get_session)
) -> schemas.CandidateStartData:
    invitation = await _get_invitation_by_token(session, token)
    assessment = invitation.assessment
    if assessment is None:
        raise HTTPException(status_code=404, detail="Assessment not found")
    seed = assessment.seed
    if seed is None:
        raise HTTPException(status_code=404, detail="Assessment seed not found")

    candidate_repo = invitation.candidate_repo

    return schemas.CandidateStartData(
        invitation=schemas.CandidateInvitation(
            id=str(invitation.id),
            assessment_id=str(invitation.assessment_id),
            candidate_email=invitation.candidate_email,
            candidate_name=invitation.candidate_name,
            status=invitation.status.value,
            start_deadline=invitation.start_deadline,
            complete_deadline=invitation.complete_deadline,
            sent_at=invitation.sent_at,
            started_at=invitation.started_at,
            submitted_at=invitation.submitted_at,
        ),
        assessment=schemas.CandidateAssessment(
            id=str(assessment.id),
            seed_id=str(assessment.seed_id),
            title=assessment.title,
            description=assessment.description,
            instructions=assessment.instructions,
            candidate_email_subject=assessment.candidate_email_subject,
            candidate_email_body=assessment.candidate_email_body,
            time_to_start_hours=_duration_hours(assessment.time_to_start),
            time_to_complete_hours=_duration_hours(assessment.time_to_complete),
        ),
        seed=schemas.CandidateSeed(
            id=str(seed.id),
            seed_repo=seed.seed_repo_full_name,
            latest_main_sha=seed.latest_main_sha,
            source_repo_url=seed.source_repo_url,
        ),
        candidate_repo=(
            schemas.CandidateRepoInfo(
                id=str(candidate_repo.id),
                invitation_id=str(candidate_repo.invitation_id),
                repo_full_name=candidate_repo.repo_full_name,
                repo_html_url=candidate_repo.repo_html_url,
                seed_sha_pinned=candidate_repo.seed_sha_pinned,
                started_at=candidate_repo.created_at,
                last_commit_at=None,
            )
            if candidate_repo is not None
            else None
        ),
    )


@router.post("/start/{token}", response_model=schemas.StartAssessmentResponse)
async def start_assessment(
    token: str, session: AsyncSession = Depends(get_session)
) -> schemas.StartAssessmentResponse:
    invitation = await _get_invitation_by_token(session, token)

    now = datetime.now(timezone.utc)
    if invitation.start_deadline and now > invitation.start_deadline:
        invitation.status = models.InvitationStatus.expired
        invitation.expired_at = now
        await session.commit()
        raise HTTPException(status_code=410, detail="Invitation start window has expired")

    if invitation.status in (models.InvitationStatus.started, models.InvitationStatus.submitted):
        raise HTTPException(status_code=409, detail="Assessment already started")

    assessment = invitation.assessment
    if assessment is None or assessment.seed is None:
        raise HTTPException(status_code=400, detail="Assessment seed configuration missing")

    if not assessment.seed.latest_main_sha:
        raise HTTPException(status_code=400, detail="Seed repository does not have a pinned main SHA")

    invitation.status = models.InvitationStatus.started
    invitation.started_at = now
    invitation.complete_deadline = now + assessment.time_to_complete

    if invitation.candidate_repo is None:
        repo_full_name = f"candidate-{invitation.id}"  # placeholder until GitHub integration exists
        candidate_repo = models.CandidateRepo(
            invitation_id=invitation.id,
            seed_sha_pinned=assessment.seed.latest_main_sha,
            repo_full_name=repo_full_name,
        )
        session.add(candidate_repo)
        await session.flush()
        await session.refresh(candidate_repo)
    else:
        candidate_repo = invitation.candidate_repo

    access_token_value = generate_token()
    access_token = models.AccessToken(
        invitation_id=invitation.id,
        repo_full_name=candidate_repo.repo_full_name,
        opaque_token_hash=hash_token(access_token_value),
        expires_at=now + assessment.time_to_complete,
    )
    session.add(access_token)
    await session.commit()
    await session.refresh(candidate_repo)
    await session.refresh(access_token)

    return schemas.StartAssessmentResponse(
        invitation_id=str(invitation.id),
        candidate_repo=schemas.CandidateRepoRead.from_orm(candidate_repo),
        access_token=access_token_value,
        access_token_expires_at=access_token.expires_at,
    )


@router.post("/submit/{token}", response_model=schemas.SubmitResponse)
async def submit_assessment(
    token: str,
    payload: schemas.SubmitRequest,
    session: AsyncSession = Depends(get_session),
) -> schemas.SubmitResponse:
    invitation = await _get_invitation_by_token(session, token)

    if invitation.status != models.InvitationStatus.started:
        raise HTTPException(status_code=409, detail="Assessment is not in a started state")

    candidate_repo = invitation.candidate_repo
    if candidate_repo is None:
        raise HTTPException(status_code=400, detail="Candidate repository has not been provisioned")

    now = datetime.now(timezone.utc)
    invitation.status = models.InvitationStatus.submitted
    invitation.submitted_at = now

    submission = models.Submission(
        invitation_id=invitation.id,
        final_sha=payload.final_sha,
        repo_html_url=payload.repo_html_url or candidate_repo.repo_html_url,
    )
    session.add(submission)

    # Revoke all active access tokens for this invitation
    for token_model in invitation.access_tokens:
        if not token_model.revoked:
            token_model.revoked = True

    await session.commit()
    await session.refresh(submission)

    return schemas.SubmitResponse(
        invitation_id=str(invitation.id),
        submission_id=str(submission.id),
        final_sha=submission.final_sha,
        submitted_at=invitation.submitted_at,
    )

