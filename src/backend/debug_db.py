import asyncio
import motor.motor_asyncio
from core.config import settings
from core.database import db
import certifi

async def debug_db():
    client = motor.motor_asyncio.AsyncIOMotorClient(
        settings.mongodb_uri,
        tlsCAFile=certifi.where()
    )
    db_name = settings.database_name
    col = client[db_name]["competitor_definitions"]
    
    docs = await col.find().to_list(length=100)
    print(f"Total documents in {db_name}.competitor_definitions: {len(docs)}")
    for d in docs:
        print(f"- {d.get('name')} (ID: {d.get('id')})")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(debug_db())
