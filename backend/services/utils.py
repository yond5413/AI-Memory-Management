import uuid
from datetime import datetime

def gen_id(prefix: str) -> str:
    """Generate a unique ID with a prefix."""
    return f"{prefix}_{uuid.uuid4().hex[:8]}"

def normalize_datetime(dt) -> str:
    """Normalize datetime object to ISO string."""
    if isinstance(dt, datetime):
        return dt.isoformat()
    return str(dt)
