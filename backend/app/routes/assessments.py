"""Assessment endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..database import get_session

router = APIRouter(prefix="/api/assessments", tags=["assessments"])


@router.post("", response_model=schemas.AssessmentRead, status_code=201)
async def create_assessment(
    payload: schemas.AssessmentCreate, session: AsyncSession = Depends(get_session)
) -> schemas.AssessmentRead:
    try:
        org_id = uuid.UUID(payload.org_id)
        seed_id = uuid.UUID(payload.seed_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid org or seed id") from exc

    org_result = await session.execute(select(models.Org).where(models.Org.id == org_id))
    if org_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Organization not found")

    seed_result = await session.execute(
        select(models.Seed).where(models.Seed.id == seed_id, models.Seed.org_id == org_id)
    )
    seed = seed_result.scalar_one_or_none()
    if seed is None:
        raise HTTPException(status_code=404, detail="Seed not found for this organization")

    assessment = models.Assessment(
        org_id=org_id,
        seed_id=seed_id,
        title=payload.title,
        description=payload.description,
        instructions=payload.instructions,
        candidate_email_subject=payload.candidate_email_subject,
        candidate_email_body=payload.candidate_email_body,
        time_to_start=payload.time_to_start,
        time_to_complete=payload.time_to_complete,
        created_by=uuid.UUID(payload.created_by) if payload.created_by else None,
    )
    session.add(assessment)
    await session.commit()
    await session.refresh(assessment)
    return schemas.AssessmentRead.from_orm(assessment)


@router.get("/{assessment_id}", response_model=schemas.AssessmentRead)
async def get_assessment(
    assessment_id: str, session: AsyncSession = Depends(get_session)
) -> schemas.AssessmentRead:
    try:
        assessment_uuid = uuid.UUID(assessment_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid assessment id") from exc

    result = await session.execute(
        select(models.Assessment).where(models.Assessment.id == assessment_uuid)
    )
    assessment = result.scalar_one_or_none()
    if assessment is None:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return schemas.AssessmentRead.from_orm(assessment)

