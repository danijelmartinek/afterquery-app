from __future__ import annotations

import logging
import os
from typing import Iterable, Optional
from urllib.parse import urlsplit

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import lifespan
from .routes import admin, assessments, candidate, invitations, orgs, seeds

app = FastAPI(title="Backend API", lifespan=lifespan)

logger = logging.getLogger(__name__)


def _normalize_origin(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    trimmed = value.strip()
    if not trimmed:
        return None
    parsed = urlsplit(trimmed)
    if not parsed.scheme or not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}"


def _collect_cors_origins() -> list[str]:
    origin_keys: Iterable[str] = ("FRONTEND_APP_URL", "CANDIDATE_APP_URL", "SUPABASE_URL")
    origins = {
        origin
        for origin in (
            _normalize_origin(os.getenv(key))
            for key in origin_keys
        )
        if origin
    }

    extra_origins = os.getenv("ADDITIONAL_CORS_ORIGINS")
    if extra_origins:
        for candidate in extra_origins.split(","):
            normalized = _normalize_origin(candidate)
            if normalized:
                origins.add(normalized)

    if not origins:
        # Fall back to local development defaults when nothing is configured.
        origins.update(
            {
                "http://localhost:3000",
                "http://127.0.0.1:3000",
            }
        )
        logger.debug(
            "CORS origins not configured; defaulting to local development origins: %s",
            sorted(origins),
        )
    else:
        logger.debug("Configured CORS origins: %s", sorted(origins))

    return sorted(origins)


allowed_origins = _collect_cors_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(orgs.router)
app.include_router(seeds.router)
app.include_router(assessments.router)
app.include_router(invitations.router)
app.include_router(candidate.router)


@app.get("/")
async def root():
    return {"message": "Backend is running 🚀"}
