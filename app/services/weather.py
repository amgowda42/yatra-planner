from datetime import date

import httpx

try:
    from app.models import WeatherResponse
    from app.services.cache import get_cache, set_cache
except ModuleNotFoundError:  # pragma: no cover - allows running the app from the app directory
    from models import WeatherResponse
    from services.cache import get_cache, set_cache

async def fetch_weather_data(destination: str, start_date: date, end_date: date)-> list[WeatherResponse]:
    """
    Fetch weather data for the given destination and date range.
    This is a placeholder function. In a real implementation, you would call an external weather API.

    Args:
        destination (str): The destination for which to fetch weather data.
        start_date (date): The start date of the trip.
        end_date (date): The end date of the trip.
    """

    cache_key = f"{destination}_{start_date}_{end_date}"
    cached_data = get_cache(cache_key)

    if cached_data:
        return cached_data

    async with httpx.AsyncClient() as client:
        response = await client.get(f"https://api.weatherapi.com/v1/forecast.json",
            params={
                "key": "92012580e9ee42ecb3a70803261411",  #
                "q": destination,
                "dq": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            }
        )
        response.raise_for_status()
        data = response.json()
        forcasts = []
        for forecast in data.get("forecast", {}).get("forecastday", []):
            forcasts.append(WeatherResponse(
                date=forecast["date"],
                condition=forecast["day"]["condition"]["text"],
                temperature_high=forecast["day"]["maxtemp_c"],
                temperature_low=forecast["day"]["mintemp_c"],
                humidity=forecast["day"]["avghumidity"],
                rain_chance=forecast["day"]["daily_chance_of_rain"]
            ))
        set_cache(cache_key, forcasts, ttl=3600)  # Cache for 1 hour
        return forcasts
    
