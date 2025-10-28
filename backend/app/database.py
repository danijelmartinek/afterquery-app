"""Database configuration for the FastAPI backend.

This module provides a SQLAlchemy async engine and session factory that connect to
Supabase Postgres using the DATABASE_URL environment variable. Supabase issues
Postgres connection strings that require the ``postgresql`` dialect. To take
advantage of SQLAlchemy's async support we convert the DSN to the
``postgresql+asyncpg`` driver if needed.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from dotenv import find_dotenv, load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Load DATABASE_URL and other environment variables from the project root ``.env``
# file, if present. ``find_dotenv`` walks up from the current working directory,
# so it will locate the repository-level configuration even when this module is
# imported from nested packages.
_DOTENV_PATH = find_dotenv(filename=".env", raise_error_if_not_found=False, usecwd=True)
if _DOTENV_PATH:
    load_dotenv(_DOTENV_PATH)

_DATABASE_URL_ENV = "DATABASE_URL"

print(f"✅ Loaded .env from: {_DOTENV_PATH}")
print(f"📦 DATABASE_URL = {os.getenv('DATABASE_URL')}")


def _build_async_database_url(raw_url: str) -> str:
    """Ensure the database URL uses the asyncpg driver."""

    if raw_url.startswith("postgresql+asyncpg://"):
        return raw_url
    if raw_url.startswith("postgres://"):
        raw_url = raw_url.replace("postgres://", "postgresql://", 1)
    if raw_url.startswith("postgresql://"):
        return raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return raw_url


def get_database_url() -> str:
    try:
        raw_url = os.environ[_DATABASE_URL_ENV]
    except KeyError as exc:  # pragma: no cover - configuration error should be explicit
        raise RuntimeError(
            "DATABASE_URL environment variable must be set to connect to Supabase"
        ) from exc
    return _build_async_database_url(raw_url)


ASYNC_ENGINE = create_async_engine(get_database_url(), echo=False, future=True)
ASYNC_SESSION_FACTORY = async_sessionmaker(
    ASYNC_ENGINE, expire_on_commit=False, class_=AsyncSession
)


@asynccontextmanager
async def lifespan(app):  # pragma: no cover - FastAPI hook
    """Ensure the database engine is disposed when the app shuts down."""

    yield
    await ASYNC_ENGINE.dispose()


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an ``AsyncSession``."""

    async with ASYNC_SESSION_FACTORY() as session:
        yield session

