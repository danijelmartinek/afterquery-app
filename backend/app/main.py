from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import lifespan
from .routes import assessments, candidate, invitations, orgs, seeds

app = FastAPI(title="Backend API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(orgs.router)
app.include_router(seeds.router)
app.include_router(assessments.router)
app.include_router(invitations.router)
app.include_router(candidate.router)


@app.get("/")
async def root():
    return {"message": "Backend is running 🚀"}

