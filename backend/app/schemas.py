"""Pydantic models for API requests and responses."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class OrgCreate(BaseModel):
    name: str


class OrgRead(OrgCreate):
    id: str = Field(..., description="Org UUID")
    created_at: datetime

    class Config:
        orm_mode = True


class SeedCreate(BaseModel):
    org_id: str
    source_repo_url: str
    seed_repo_full_name: str
    default_branch: str = "main"
    is_template: bool = True
    latest_main_sha: Optional[str]


class SeedRead(SeedCreate):
    id: str
    created_at: datetime

    class Config:
        orm_mode = True


class AssessmentCreate(BaseModel):
    org_id: str
    seed_id: str
    title: str
    description: Optional[str]
    instructions: Optional[str]
    candidate_email_subject: Optional[str]
    candidate_email_body: Optional[str]
    time_to_start: timedelta
    time_to_complete: timedelta
    created_by: Optional[str]


class AssessmentRead(AssessmentCreate):
    id: str
    created_at: datetime

    class Config:
        orm_mode = True


class InvitationCreate(BaseModel):
    candidate_email: EmailStr
    candidate_name: Optional[str]


class InvitationBatchCreate(BaseModel):
    assessment_id: str
    invitations: List[InvitationCreate]


class InvitationRead(BaseModel):
    id: str
    assessment_id: str
    candidate_email: EmailStr
    candidate_name: Optional[str]
    status: str
    start_deadline: Optional[datetime]
    complete_deadline: Optional[datetime]
    start_link_token: str
    sent_at: datetime

    class Config:
        orm_mode = True


class CandidateRepoRead(BaseModel):
    id: str
    invitation_id: str
    seed_sha_pinned: str
    repo_full_name: str
    repo_html_url: Optional[str]
    github_repo_id: Optional[int]
    active: bool
    archived: bool
    created_at: datetime

    class Config:
        orm_mode = True


class StartAssessmentResponse(BaseModel):
    invitation_id: str
    candidate_repo: CandidateRepoRead
    access_token: str = Field(..., description="Opaque token presented to the git credential broker")
    access_token_expires_at: datetime


class SubmitRequest(BaseModel):
    final_sha: str
    repo_html_url: Optional[str]


class SubmitResponse(BaseModel):
    invitation_id: str
    submission_id: str
    final_sha: str
    submitted_at: datetime


class InvitationDetail(BaseModel):
    id: str
    assessment_id: str
    candidate_email: EmailStr
    candidate_name: Optional[str]
    status: str
    start_deadline: Optional[datetime]
    complete_deadline: Optional[datetime]
    sent_at: datetime
    started_at: Optional[datetime]
    submitted_at: Optional[datetime]
    expired_at: Optional[datetime]

    class Config:
        orm_mode = True

