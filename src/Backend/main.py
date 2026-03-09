from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.ga_routes import router as ga_router

app = FastAPI(
    title="Social Analytics Dashboard API",
    description=(
        "Backend API for the Club Artizen Social Media Analytics Dashboard. "
        "Provides Google Analytics 4 website metrics alongside social channel data."
    ),
    version="1.0.0",
)

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(ga_router)


# ── Root / Health ─────────────────────────────────────────────────────────────

@app.get("/", tags=["Root"])
def read_root():
    return {"message": "Welcome to the Social Analytics Dashboard API!"}


@app.get("/health", tags=["Root"])
def health_check():
    return {"status": "ok"}

