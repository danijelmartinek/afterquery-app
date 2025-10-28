"""SQLAlchemy ORM models for the coding interview platform backend."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Interval,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import BIGINT, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


class InvitationStatus(enum.Enum):
    sent = "sent"
    accepted = "accepted"
    started = "started"
    submitted = "submitted"
    expired = "expired"
    revoked = "revoked"


class AccessScope(enum.Enum):
    clone = "clone"
    push = "push"
    clone_push = "clone+push"


class EmailEventType(enum.Enum):
    invite = "invite"
    reminder = "reminder"
    follow_up = "follow_up"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Org(Base, TimestampMixin):
    __tablename__ = "orgs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String, nullable=False)

    members: Mapped[list["OrgMember"]] = relationship(back_populates="org")
    seeds: Mapped[list["Seed"]] = relationship(back_populates="org")
    email_templates: Mapped[list["EmailTemplate"]] = relationship(back_populates="org")

class OrgMember(Base, TimestampMixin):
    __tablename__ = "org_members"
    __table_args__ = (
        UniqueConstraint("org_id", "supabase_user_id", name="uq_org_member"),
        CheckConstraint("role IN ('owner','admin','viewer')", name="ck_org_member_role"),
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id", ondelete="CASCADE"), primary_key=True
    )
    supabase_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    display_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    role: Mapped[str] = mapped_column(String, nullable=False)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    org: Mapped[Org] = relationship(back_populates="members")


class Seed(Base, TimestampMixin):
    __tablename__ = "seeds"
    __table_args__ = (Index("idx_seeds_org_id", "org_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False
    )
    source_repo_url: Mapped[str] = mapped_column(Text, nullable=False)
    seed_repo_full_name: Mapped[str] = mapped_column(Text, nullable=False)
    default_branch: Mapped[str] = mapped_column(String, default="main", nullable=False)
    is_template: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    latest_main_sha: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    org: Mapped[Org] = relationship(back_populates="seeds")
    assessments: Mapped[list["Assessment"]] = relationship(back_populates="seed")


class Assessment(Base, TimestampMixin):
    __tablename__ = "assessments"
    __table_args__ = (Index("idx_assessments_org_id", "org_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False
    )
    seed_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("seeds.id", ondelete="RESTRICT"), nullable=False
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    candidate_email_subject: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    candidate_email_body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    time_to_start: Mapped[timedelta] = mapped_column(Interval, nullable=False)
    time_to_complete: Mapped[timedelta] = mapped_column(Interval, nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)

    org: Mapped[Org] = relationship()
    seed: Mapped[Seed] = relationship(back_populates="assessments")
    invitations: Mapped[list["Invitation"]] = relationship(back_populates="assessment")


class Invitation(Base):
    __tablename__ = "invitations"
    __table_args__ = (Index("idx_invitations_assessment_id", "assessment_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    assessment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False
    )
    candidate_email: Mapped[str] = mapped_column(String, nullable=False)
    candidate_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[InvitationStatus] = mapped_column(
        Enum(
            InvitationStatus,
            name="invitation_status",
            native_enum=False,
            validate_strings=True,
        ),
        default=InvitationStatus.sent,
        nullable=False,
    )
    start_deadline: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    complete_deadline: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    start_link_token_hash: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    submitted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    expired_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    assessment: Mapped[Assessment] = relationship(back_populates="invitations")
    candidate_repo: Mapped[Optional["CandidateRepo"]] = relationship(
        back_populates="invitation", uselist=False
    )
    access_tokens: Mapped[list["AccessToken"]] = relationship(back_populates="invitation")
    submissions: Mapped[list["Submission"]] = relationship(back_populates="invitation")
    review_comments: Mapped[list["ReviewComment"]] = relationship(back_populates="invitation")
    review_feedback: Mapped[list["ReviewFeedback"]] = relationship(back_populates="invitation")
    email_events: Mapped[list["EmailEvent"]] = relationship(back_populates="invitation")


class CandidateRepo(Base, TimestampMixin):
    __tablename__ = "candidate_repos"
    __table_args__ = (
        Index("idx_candidate_repos_repo_full_name", "repo_full_name", unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invitation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invitations.id", ondelete="CASCADE"), nullable=False
    )
    seed_sha_pinned: Mapped[str] = mapped_column(String, nullable=False)
    repo_full_name: Mapped[str] = mapped_column(String, nullable=False)
    repo_html_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    github_repo_id: Mapped[Optional[int]] = mapped_column(BIGINT, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    invitation: Mapped[Invitation] = relationship(back_populates="candidate_repo")


class AccessToken(Base, TimestampMixin):
    __tablename__ = "access_tokens"
    __table_args__ = (
        Index("idx_access_tokens_invitation_id", "invitation_id"),
        UniqueConstraint("opaque_token_hash", name="uq_access_token_hash"),
        CheckConstraint(
            "scope IN ('clone','push','clone+push')",
            name="ck_access_token_scope",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invitation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invitations.id", ondelete="CASCADE"), nullable=False
    )
    repo_full_name: Mapped[str] = mapped_column(String, nullable=False)
    opaque_token_hash: Mapped[str] = mapped_column(String, nullable=False)
    scope: Mapped[AccessScope] = mapped_column(
        Enum(
            AccessScope,
            name="access_scope",
            native_enum=False,
            validate_strings=True,
            create_constraint=False,
        ),
        default=AccessScope.clone_push,
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    invitation: Mapped[Invitation] = relationship(back_populates="access_tokens")


class Submission(Base, TimestampMixin):
    __tablename__ = "submissions"
    __table_args__ = (Index("idx_submissions_invitation_id", "invitation_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invitation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invitations.id", ondelete="CASCADE"), nullable=False
    )
    final_sha: Mapped[str] = mapped_column(String, nullable=False)
    repo_html_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    invitation: Mapped[Invitation] = relationship(back_populates="submissions")


class ReviewComment(Base, TimestampMixin):
    __tablename__ = "review_comments"
    __table_args__ = (Index("idx_review_comments_invitation_id", "invitation_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invitation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invitations.id", ondelete="CASCADE"), nullable=False
    )
    path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    line: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    invitation: Mapped[Invitation] = relationship(back_populates="review_comments")


class ReviewFeedback(Base, TimestampMixin):
    __tablename__ = "review_feedback"
    __table_args__ = (Index("idx_review_feedback_invitation_id", "invitation_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invitation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invitations.id", ondelete="CASCADE"), nullable=False
    )
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    invitation: Mapped[Invitation] = relationship(back_populates="review_feedback")


class EmailTemplate(Base, TimestampMixin):
    __tablename__ = "email_templates"
    __table_args__ = (UniqueConstraint("org_id", "key", name="uq_email_template_key"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False
    )
    key: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    subject: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    org: Mapped[Org] = relationship(back_populates="email_templates")


class EmailEvent(Base, TimestampMixin):
    __tablename__ = "email_events"
    __table_args__ = (Index("idx_email_events_invitation_id", "invitation_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invitation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invitations.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[Optional[EmailEventType]] = mapped_column(
        Enum(
            EmailEventType,
            name="email_event_type",
            native_enum=False,
            validate_strings=True,
        ),
        nullable=True,
    )
    provider_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    to_email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    invitation: Mapped[Invitation] = relationship(back_populates="email_events")


class AuditEvent(Base):
    __tablename__ = "audit_events"
    __table_args__ = (
        Index("idx_audit_events_kind", "kind"),
        Index("idx_audit_events_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    kind: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    actor: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    meta: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )

