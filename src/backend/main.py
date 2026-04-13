from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from contextlib import asynccontextmanager
from motor.motor_asyncio import AsyncIOMotorClient
from core.database import db
from core.config import settings

from routes.ga_routes import router as ga_router
from routes.yt_routes import router as yt_router
from routes.auth_routes import router as auth_router
from routes.li_routes import router as li_router
from routes.ig_routes import router as ig_router
from routes.wa_routes import router as wa_router
from routes.social_insights_routes import router as social_insights_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    db.client = AsyncIOMotorClient(settings.mongodb_uri)
    yield
    # Shutdown
    db.client.close()

app = FastAPI(
    title="Social Analytics Dashboard API",
    description=(
        "Backend API for the Club Artizen Social Media Analytics Dashboard. "
        "Provides Google Analytics 4 website metrics alongside social channel data."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(ga_router)
app.include_router(yt_router)
app.include_router(auth_router, prefix="/auth", tags=["Auth"])
app.include_router(li_router)
app.include_router(ig_router)
app.include_router(wa_router)
app.include_router(social_insights_router)


# ── Root / Health ─────────────────────────────────────────────────────────────

@app.get("/", tags=["Root"])
def read_root():
    return {"message": "Welcome to the Social Analytics Dashboard API!"}


@app.get("/health", tags=["Root"])
def health_check():
    return {"status": "ok"}
