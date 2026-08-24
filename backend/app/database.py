"""Supabase database client — single source of truth for all persistent data."""

from supabase import create_client, Client
from app.config import SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY

_client: Client | None = None
_service_client: Client | None = None


def get_client() -> Client:
    """Public (anon) client — respects RLS."""
    global _client
    if _client is None and SUPABASE_URL and SUPABASE_KEY:
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def get_service_client() -> Client:
    """Service-role client — bypasses RLS. Use for backend writes."""
    global _service_client
    if _service_client is None and SUPABASE_URL and SUPABASE_SERVICE_KEY:
        _service_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _service_client


def is_configured() -> bool:
    """Check if Supabase credentials are set."""
    return bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)
