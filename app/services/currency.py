
import httpx

try:
    from app.services.cache import get_cache, set_cache
except ModuleNotFoundError:  # allows running the app from the app directory
    from services.cache import get_cache, set_cache


async def fetch_currency_data(base_currency: str, target_currency: str, amount: float) -> float:
    """
    Fetch currency conversion data for the given base and target currencies.
    This is a placeholder function. In a real implementation, you would call an external currency conversion API.
    """
    cache_key = f"{base_currency}_{target_currency}_{amount}"
    cached_data = get_cache(cache_key)

    if cached_data:
        return cached_data

    async with httpx.AsyncClient() as client:
        response = await client.get(f"https://v6.exchangerate-api.com/v6/25cdcf7ac420e4dfd9212db9/latest/{base_currency}")
        response.raise_for_status()
        data = response.json()
        rates = data.get("conversion_rates")
        if not isinstance(rates, dict):
            raise ValueError("Currency API response did not include conversion rates.")
        conversion_rate = rates.get(target_currency)
        if conversion_rate is None:
            raise ValueError(f"Conversion rate for {target_currency} not found.")
        converted_amount = amount * conversion_rate
        set_cache(cache_key, converted_amount, ttl=3600)  # Cache for 1 hour
        return converted_amount