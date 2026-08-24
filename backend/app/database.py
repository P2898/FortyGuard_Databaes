"""Supabase database client using direct REST API (no supabase-py dependency).

Uses httpx to call Supabase PostgREST API directly.
This avoids the pydantic-core Rust compilation issue on Render free tier.
"""

import httpx
from app.config import SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY

_client: httpx.AsyncClient | None = None


def is_configured() -> bool:
    """Check if Supabase credentials are set."""
    return bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)


def _get_rest_url(table: str) -> str:
    return f"{SUPABASE_URL}/rest/v1/{table}"


def _anon_headers() -> dict:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }


def _service_headers() -> dict:
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }


class SupabaseQuery:
    """Simplified Supabase-like query builder using direct REST calls."""

    def __init__(self, table: str, service: bool = True):
        self.table = table
        self.headers = _service_headers() if service else _anon_headers()
        self._select = "*"
        self._filters: list[tuple[str, str, str]] = []
        self._order: str | None = None
        self._desc = False
        self._limit: int | None = None
        self._single = False

    def select(self, cols: str = "*"):
        self._select = cols
        return self

    def eq(self, col: str, val: str):
        self._filters.append(("eq", col, str(val)))
        return self

    def order(self, col: str, desc: bool = False):
        self._order = col
        self._desc = desc
        return self

    def limit(self, n: int):
        self._limit = n
        return self

    def maybe_single(self):
        self._single = True
        return self

    def _build_url(self) -> str:
        params = {"select": self._select}
        for op, col, val in self._filters:
            if op == "eq":
                params[col] = f"eq.{val}"
        if self._order:
            params["order"] = f"{self._order}.{'desc' if self._desc else 'asc'}"
        if self._limit:
            params["limit"] = str(self._limit)
        if self._single:
            params["limit"] = "1"
        qs = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{_get_rest_url(self.table)}?{qs}"

    def execute(self):
        import httpx as _httpx
        url = self._build_url()
        resp = _httpx.get(url, headers=self.headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        if self._single:
            data = data[0] if data else None
        return QueryResult(data)

    def insert(self, row: dict):
        import httpx as _httpx
        url = _get_rest_url(self.table)
        resp = _httpx.post(url, headers={**self.headers, "Prefer": "return=minimal"}, json=row, timeout=30)
        resp.raise_for_status()
        return QueryResult(None)

    def update(self, row: dict):
        import httpx as _httpx
        params = {}
        for op, col, val in self._filters:
            if op == "eq":
                params[col] = f"eq.{val}"
        qs = "&".join(f"{k}={v}" for k, v in params.items())
        url = f"{_get_rest_url(self.table)}?{qs}"
        resp = _httpx.patch(url, headers={**self.headers, "Prefer": "return=minimal"}, json=row, timeout=30)
        resp.raise_for_status()
        return QueryResult(None)

    def delete(self):
        import httpx as _httpx
        params = {}
        for op, col, val in self._filters:
            if op == "eq":
                params[col] = f"eq.{val}"
        qs = "&".join(f"{k}={v}" for k, v in params.items())
        url = f"{_get_rest_url(self.table)}?{qs}"
        resp = _httpx.delete(url, headers=self.headers, timeout=30)
        resp.raise_for_status()
        return QueryResult(None)


class QueryResult:
    def __init__(self, data):
        self.data = data if isinstance(data, list) else ([data] if data is not None else [])
        if isinstance(data, dict):
            self.data = [data]


class _TableProxy:
    """Proxy that mimics supabase table() interface."""
    def __init__(self, table: str, service: bool = True):
        self._table = table
        self._service = service

    def select(self, cols="*"):
        return SupabaseQuery(self._table, self._service).select(cols)

    def insert(self, row):
        return SupabaseQuery(self._table, self._service).insert(row)

    def update(self, row):
        return SupabaseQuery(self._table, self._service).update(row)

    def delete(self):
        return SupabaseQuery(self._table, self._service).delete()


class SupabaseClient:
    """Minimal Supabase-compatible client using direct REST API."""

    def table(self, name: str):
        return _TableProxy(name, service=True)


def get_service_client() -> SupabaseClient:
    """Service-role client — bypasses RLS."""
    return SupabaseClient()


def get_client() -> SupabaseClient:
    """Public (anon) client."""
    return SupabaseClient()
