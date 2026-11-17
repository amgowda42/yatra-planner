import asyncio
from datetime import date

from fastapi import APIRouter, HTTPException, status

try:
    from app.models import Plan
    from app.services.cache import clear_cache, get_cache_stats
    from app.services.currency import fetch_currency_data
    from app.services.places import get_places_for_destination
    from app.services.weather import fetch_weather_data
except ModuleNotFoundError:  # allows running the app from the app directory
    from models import Plan
    from services.cache import clear_cache, get_cache_stats
    from services.currency import fetch_currency_data
    from services.places import get_places_for_destination
    from services.weather import fetch_weather_data

MAX_TRIP_DAYS = 30

router = APIRouter(
    prefix="/plan",
    tags=["Travel Plan"],
)


@router.get("/cache-stats")
async def travel_plan_cache_stats():
    """Return the number of active cached upstream responses."""
    return get_cache_stats()


@router.delete("/")
async def clear_travel_plan_cache():
    """Clear cached upstream travel-plan data."""
    clear_cache()
    return {"message": "Travel plan cache cleared."}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_travel_plan(plan: Plan):
    """
    Create a new travel plan by aggregating Weather, Currency and Places data
    from multiple sources into a single response.
    """
    if plan.start_date > plan.end_date:
        raise HTTPException(status_code=400, detail="Start date cannot be after end date.")
    if plan.start_date < date.today():
        raise HTTPException(status_code=400, detail="Start date cannot be in the past.")

    trip_duration = (plan.end_date - plan.start_date).days
    if trip_duration < 1:
        raise HTTPException(status_code=400, detail="Trip duration must be at least one day.")
    if trip_duration > MAX_TRIP_DAYS:
        raise HTTPException(
            status_code=400,
            detail=f"Trip duration cannot exceed {MAX_TRIP_DAYS} days.",
        )

    async def fetch_places():
        return get_places_for_destination(plan.destination)

    # Run all three upstream calls concurrently; one failure won't cancel the others.
    weather, places, currency = await asyncio.gather(
        fetch_weather_data(plan.destination, plan.start_date, plan.end_date),
        fetch_places(),
        fetch_currency_data(plan.base_currency, "USD", plan.amount),
        return_exceptions=True,
    )

    results = {"weather": weather, "places": places, "currency": currency}
    errors = {name: str(r) for name, r in results.items() if isinstance(r, Exception)}

    if len(errors) == len(results):
        raise HTTPException(status_code=502, detail="All upstream services failed.")

    return {
        "message": "Travel plan created successfully.",
        "destination": plan.destination,
        "duration_days": trip_duration,
        "weather": None if "weather" in errors else weather,
        "places": None if "places" in errors else places,
        "currency": None if "currency" in errors else currency,
        "errors": errors or None,
    }