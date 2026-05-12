from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING

client: AsyncIOMotorClient = None
db: AsyncIOMotorDatabase = None


async def connect_db():
    global client, db
    from config import settings
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    print(f"Connected to MongoDB: {settings.DATABASE_NAME}")


async def disconnect_db():
    global client
    if client:
        client.close()
        print("MongoDB connection closed")


async def create_indexes():
    # users: unique phone
    await db.users.create_index([("phone", ASCENDING)], unique=True)
    # events: lookup by owner
    await db.events.create_index([("user_id", ASCENDING)])
    # guests: phone lookup per event (used in webhook matching)
    await db.guests.create_index([("event_id", ASCENDING), ("phone", ASCENDING)])
    # entries: all entry queries scope to event_id
    await db.entries.create_index([("event_id", ASCENDING)])
    # activities: lookup by event, and by event+status for webhook auto-assignment
    await db.activities.create_index("event_id")
    await db.activities.create_index([("event_id", ASCENDING), ("status", ASCENDING)])
    # entries: activity-scoped queries
    await db.entries.create_index("activity_id")
    print("MongoDB indexes ensured")


def get_db() -> AsyncIOMotorDatabase:
    return db
