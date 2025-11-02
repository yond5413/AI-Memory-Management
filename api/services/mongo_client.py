"""MongoDB client and connection management."""
from pymongo import MongoClient
from pymongo.database import Database
from api.config import settings
from typing import Optional


_client: Optional[MongoClient] = None
_db: Optional[Database] = None


def get_db() -> Database:
    """Get MongoDB database instance."""
    global _db
    if _db is None:
        client = MongoClient(settings.mongodb_uri)
        _db = client[settings.mongodb_db_name]
    return _db


def close_db():
    """Close MongoDB connection."""
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None

