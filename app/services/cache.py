import time

_cache: dict[str, dict] = {}


def get_cache(key: str) -> dict | None:
    """Retrieve a value from the cache."""
    if key not in _cache:
        return None

    entry = _cache[key]
    if time.time() - entry['created_at'] > entry['ttl']:
        del _cache[key]
        return None

    return entry['value']

def set_cache(key: str, value: dict, ttl: int) -> None:
    """Store a value in the cache with a time-to-live (TTL)."""
    _cache[key] = {
        'value': value,
        'created_at': time.time(),
        'ttl': ttl
    }

def clear_cache() -> None:
    """Clear the entire cache."""
    _cache.clear()

def get_cache_stats() -> dict[str, int]:
    """Return the number of unexpired entries currently held in the cache."""
    now = time.time()
    expired_keys = [
        key
        for key, entry in _cache.items()
        if now - entry["created_at"] > entry["ttl"]
    ]
    for key in expired_keys:
        del _cache[key]

    return {"entries": len(_cache)}
