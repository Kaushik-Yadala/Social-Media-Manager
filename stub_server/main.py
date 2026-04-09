"""
Stub Server — standalone mock Meta Graph API for Instagram Insights.

Completely independent of the main backend.
Run: uvicorn main:app --port 8001 --reload
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers.insights import router as insights_router
from app.tasks.cron import start_scheduler, stop_scheduler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ───────────────────────────────────────────────────────
    client = await init_db()
    start_scheduler()  # daily cron for auto-generating insights
    yield
    # ── Shutdown ──────────────────────────────────────────────────────
    stop_scheduler()
    client.close()


app = FastAPI(
    title="Instagram Insights Stub Server",
    description=(
        "A black-box mock of the Meta Graph API for Instagram Media Insights. "
        "Returns responses in Meta's exact JSON format."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Allow all origins for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(insights_router)


# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/", tags=["Root"])
def root():
    return {"message": "Instagram Insights Stub Server is running."}


@app.get("/health", tags=["Root"])
def health():
    return {"status": "ok"}
