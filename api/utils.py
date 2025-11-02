"""Utility functions for ID generation and other helpers."""
import uuid
import base64
from typing import Literal


def gen_id(prefix: Literal["mem", "rel", "vec", "ent"] = "mem") -> str:
    """
    Generate a short, prefixed UUID-based ID.
    
    Args:
        prefix: One of "mem", "rel", "vec", "ent"
    
    Returns:
        A prefixed ID like "mem_3fa2b1"
    """
    raw = uuid.uuid4().bytes
    short = base64.urlsafe_b64encode(raw)[:8].decode("utf-8")
    return f"{prefix}_{short}"


