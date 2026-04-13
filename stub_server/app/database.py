"""
MongoDB / Beanie initialisation for the stub server.

Completely independent of the main backend — uses its own database.
"""

import os
from dotenv import load_dotenv
from pymongo import AsyncMongoClient
from beanie import init_beanie

load_dotenv()  # reads stub_server/.env

from app.models.instagram import InstagramInsight

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("STUB_DB_NAME", "stub_instagram")


async def init_db():
    """Create an async Mongo client and initialise Beanie models."""
    client = AsyncMongoClient(MONGO_URI)
    await init_beanie(
        database=client[DB_NAME],
        document_models=[InstagramInsight],
    )
    return client
