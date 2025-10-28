"""Pydantic models for API requests and responses."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, ConfigDict, computed_field


def _to_camel(string: str) -> str:
    """Convert ``snake_case`` strings to ``camelCase``."""

    parts = string.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


class CamelModel(BaseModel):
    """Base model that renders JSON keys using ``camelCase``."""

    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class SeedSummary(BaseModel):
    created_org: bool
    org_id: str
    created_owner_membership: bool
    owner_supabase_user_id: Optional[str]
    owner_email: Optional[str]
    owner_is_approved: bool
    created_seed: bool
    seed_id: str
    created_assessment: bool
    assessment_id: str
    created_invitation: bool
    invitation_id: Optional[str]
    invitation_start_token: Optional[str]


class BootstrapResponse(BaseModel):
    migrated: bool
    schema_path: str
    seed: SeedSummary


class OrgCreate(BaseModel):
    name: str


class OrgRead(OrgCreate):
    id: UUID = Field(..., description="Org UUID")
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SeedCreate(BaseModel):
    org_id: UUID
    source_repo_url: str
    default_branch: str = "main"


class SeedRead(BaseModel):
    id: UUID
    org_id: UUID
    source_repo_url: str
    seed_repo_full_name: str
    default_branch: str
    latest_main_sha: Optional[str]
    created_at: datetime

    @computed_field
    @property
    def seed_repo_url(self) -> str:
        return f"https://github.com/{self.seed_repo_full_name}"

    model_config = ConfigDict(from_attributes=True)


class AssessmentCreate(BaseModel):
    org_id: UUID
    seed_id: UUID
    title: str
    description: Optional[str]
    instructions: Optional[str]
    candidate_email_subject: Optional[str]
    candidate_email_body: Optional[str]
    time_to_start: timedelta
    time_to_complete: timedelta
    created_by: Optional[UUID]


class AssessmentRead(AssessmentCreate):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InvitationCreate(BaseModel):
    candidate_email: EmailStr
    candidate_name: Optional[str]


class InvitationBatchCreate(BaseModel):
    assessment_id: UUID
    invitations: List[InvitationCreate]


class InvitationRead(BaseModel):
    id: UUID
    assessment_id: UUID
    candidate_email: EmailStr
    candidate_name: Optional[str]
    status: str
    start_deadline: Optional[datetime]
    complete_deadline: Optional[datetime]
    start_link_token: str
    sent_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CandidateRepoRead(BaseModel):
    id: UUID
    invitation_id: UUID
    seed_sha_pinned: str
    repo_full_name: str
    repo_html_url: Optional[str]
    github_repo_id: Optional[int]
    active: bool
    archived: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StartAssessmentResponse(BaseModel):
    invitation_id: UUID
    status: str
    started_at: datetime
    complete_deadline: Optional[datetime]
    candidate_repo: CandidateRepoRead
    access_token: str = Field(..., description="Opaque token presented to the git credential broker")
    access_token_expires_at: datetime


class SubmitRequest(BaseModel):
    final_sha: Optional[str] = None
    repo_html_url: Optional[str] = None


class SubmitResponse(BaseModel):
    invitation_id: UUID
    submission_id: UUID
    final_sha: str
    submitted_at: datetime
    status: str


class InvitationDetail(BaseModel):
    id: UUID
    assessment_id: UUID
    candidate_email: EmailStr
    candidate_name: Optional[str]
    status: str
    start_deadline: Optional[datetime]
    complete_deadline: Optional[datetime]
    sent_at: datetime
    started_at: Optional[datetime]
    submitted_at: Optional[datetime]
    expired_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class AdminUser(CamelModel):
    id: str
    email: Optional[str]
    name: Optional[str]
    role: Optional[str]


class AdminOrg(CamelModel):
    id: str
    name: str
    slug: str


class AdminMembership(CamelModel):
    org_id: str
    supabase_user_id: str
    role: str
    is_approved: bool


class AdminSeed(CamelModel):
    id: str
    source_repo_url: str
    seed_repo: str
    seed_repo_url: str
    default_branch: str
    latest_main_sha: Optional[str]
    created_at: datetime


class AdminAssessment(CamelModel):
    id: str
    org_id: str
    seed_id: str
    title: str
    description: Optional[str]
    instructions: Optional[str]
    candidate_email_subject: Optional[str]
    candidate_email_body: Optional[str]
    time_to_start_hours: int
    time_to_complete_hours: int
    created_by: Optional[str]
    created_at: datetime


class AdminInvitation(CamelModel):
    id: str
    assessment_id: str
    candidate_email: str
    candidate_name: Optional[str]
    status: str
    start_deadline: Optional[datetime]
    complete_deadline: Optional[datetime]
    start_link_token: Optional[str]
    sent_at: datetime
    started_at: Optional[datetime]
    submitted_at: Optional[datetime]


class AdminCandidateRepo(CamelModel):
    id: str
    invitation_id: str
    seed_sha_pinned: str
    repo_full_name: str
    repo_html_url: Optional[str]
    started_at: datetime
    last_commit_at: Optional[datetime]


class AdminReviewComment(CamelModel):
    id: str
    invitation_id: str
    author: Optional[str]
    body: str
    created_at: datetime


class AdminEmailTemplate(CamelModel):
    id: str
    org_id: str
    name: str
    subject: Optional[str]
    body: Optional[str]
    description: Optional[str]
    updated_at: datetime


class AdminOrgOverview(CamelModel):
    org: Optional[AdminOrg]
    current_admin: Optional[AdminUser]
    membership: Optional[AdminMembership]
    seeds: List[AdminSeed]
    assessments: List[AdminAssessment]
    invitations: List[AdminInvitation]
    candidate_repos: List[AdminCandidateRepo]
    review_comments: List[AdminReviewComment]
    email_templates: List[AdminEmailTemplate]


class CandidateInvitation(CamelModel):
    id: str
    assessment_id: str
    candidate_email: str
    candidate_name: Optional[str]
    status: str
    start_deadline: Optional[datetime]
    complete_deadline: Optional[datetime]
    sent_at: datetime
    started_at: Optional[datetime]
    submitted_at: Optional[datetime]


class CandidateAssessment(CamelModel):
    id: str
    seed_id: str
    title: str
    description: Optional[str]
    instructions: Optional[str]
    candidate_email_subject: Optional[str]
    candidate_email_body: Optional[str]
    time_to_start_hours: int
    time_to_complete_hours: int


class CandidateSeed(CamelModel):
    id: str
    seed_repo: str
    seed_repo_url: str
    latest_main_sha: Optional[str]
    source_repo_url: str


class CandidateRepoInfo(CamelModel):
    id: str
    invitation_id: str
    repo_full_name: str
    repo_html_url: Optional[str]
    seed_sha_pinned: str
    started_at: datetime
    last_commit_at: Optional[datetime]


class CandidateStartData(CamelModel):
    invitation: CandidateInvitation
    assessment: CandidateAssessment
    seed: CandidateSeed
    candidate_repo: Optional[CandidateRepoInfo]

