"""Helpers for managing organization memberships for Supabase users."""

from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..auth import SupabaseSession

_ROLE_PRIORITY = {"owner": 0, "admin": 1, "viewer": 2}


def _derive_supabase_name(session: SupabaseSession) -> Optional[str]:
    """Return a human-friendly name derived from Supabase metadata."""

    metadata = session.user.user_metadata if session.user.user_metadata else {}
    if isinstance(metadata, dict):
        for key in ("full_name", "name"):
            value = metadata.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    if session.user.email:
        return session.user.email
    return None


def _role_rank(role: str) -> int:
    return _ROLE_PRIORITY.get(role, len(_ROLE_PRIORITY))


async def ensure_org_membership(
    db: AsyncSession,
    org_id: uuid.UUID,
    supabase_session: SupabaseSession,
    *,
    role: str,
    approve: bool = False,
) -> models.OrgMember:
    """Ensure ``supabase_session`` has at least ``role`` membership in ``org_id``."""

    result = await db.execute(
        select(models.OrgMember).where(
            models.OrgMember.org_id == org_id,
            models.OrgMember.supabase_user_id == supabase_session.user.id,
        )
    )
    membership = result.scalar_one_or_none()

    display_name = _derive_supabase_name(supabase_session)
    email = supabase_session.user.email

    if membership is None:
        membership = models.OrgMember(
            org_id=org_id,
            supabase_user_id=supabase_session.user.id,
            email=email,
            display_name=display_name,
            role=role,
            is_approved=approve,
        )
        db.add(membership)
    else:
        updated = False
        if _role_rank(role) < _role_rank(membership.role):
            membership.role = role
            updated = True
        if email and membership.email != email:
            membership.email = email
            updated = True
        if display_name and membership.display_name != display_name:
            membership.display_name = display_name
            updated = True
        if approve and not membership.is_approved:
            membership.is_approved = True
            updated = True
        if updated:
            db.add(membership)

    await db.flush()
    return membership


async def get_org_membership(
    db: AsyncSession, org_id: uuid.UUID, supabase_user_id: uuid.UUID
) -> Optional[models.OrgMember]:
    """Return the membership for ``supabase_user_id`` within ``org_id`` if present."""

    result = await db.execute(
        select(models.OrgMember).where(
            models.OrgMember.org_id == org_id,
            models.OrgMember.supabase_user_id == supabase_user_id,
        )
    )
    return result.scalar_one_or_none()
