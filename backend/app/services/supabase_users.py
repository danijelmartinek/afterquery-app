"""Helpers for synchronizing Supabase users into the local database."""

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


async def ensure_supabase_user(
    db: AsyncSession, supabase_session: SupabaseSession
) -> models.User:
    """Create or update a local ``User`` record for ``supabase_session``."""

    supabase_user_id = supabase_session.user.id
    supabase_email = supabase_session.user.email
    preferred_name = _derive_supabase_name(supabase_session)

    user = await db.get(models.User, supabase_user_id)

    if user is None and supabase_email:
        # Existing demo data may have created the user with a generated id.
        result = await db.execute(
            select(models.User).where(models.User.email == supabase_email)
        )
        user = result.scalar_one_or_none()
        if user is not None and user.id != supabase_user_id:
            user.id = supabase_user_id

    if user is None:
        # Fallback email ensures the record satisfies the non-null constraint.
        email = supabase_email or f"{supabase_user_id}@supabase.local"
        user = models.User(id=supabase_user_id, email=email, name=preferred_name)
        db.add(user)
    else:
        updated = False
        if supabase_email and user.email != supabase_email:
            user.email = supabase_email
            updated = True
        if preferred_name and user.name != preferred_name:
            user.name = preferred_name
            updated = True
        if updated:
            db.add(user)

    await db.flush()
    return user


def _role_rank(role: str) -> int:
    return _ROLE_PRIORITY.get(role, len(_ROLE_PRIORITY))


async def ensure_org_membership(
    db: AsyncSession,
    org_id: uuid.UUID,
    user: models.User,
    *,
    role: str,
) -> models.OrgMember:
    """Ensure ``user`` has at least ``role`` membership in ``org_id``."""

    result = await db.execute(
        select(models.OrgMember).where(
            models.OrgMember.org_id == org_id,
            models.OrgMember.user_id == user.id,
        )
    )
    membership = result.scalar_one_or_none()

    if membership is None:
        membership = models.OrgMember(org_id=org_id, user_id=user.id, role=role)
        db.add(membership)
    else:
        if _role_rank(role) < _role_rank(membership.role):
            membership.role = role
            db.add(membership)

    await db.flush()
    return membership

