import asyncio
import json
import logging
from datetime import date
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import StreamingResponse

try:
    from app.models import Plan
    from app.services.currency import fetch_currency_data
    from app.services.places import get_places_for_destination
    from app.services.weather import fetch_weather_data
except ModuleNotFoundError:  # allows running the app from the app directory
    from models import Plan
    from services.currency import fetch_currency_data
    from services.places import get_places_for_destination
    from services.weather import fetch_weather_data

logger = logging.getLogger(__name__)
MAX_TRIP_DAYS = 30

router = APIRouter(prefix="/plan", tags=["Travel Plan"])


def _sse(event: str, payload: Any) -> str:
    data = json.dumps(jsonable_encoder(payload), separators=(",", ":"))
    return f"event: {event}\ndata: {data}\n\n"


@router.post("/stream")
async def stream_travel_plan(plan: Plan):
    """Stream travel-plan data as Server-Sent Events."""
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

    async def event_stream():
        sources = {
            "weather": fetch_weather_data(
                plan.destination, plan.start_date, plan.end_date
            ),
            "currency": fetch_currency_data(
                plan.base_currency, "USD", plan.amount
            ),
        }
        tasks = {
            asyncio.create_task(awaitable): name
            for name, awaitable in sources.items()
        }

        async def fetch_places():
            return get_places_for_destination(plan.destination)

        places_task = asyncio.create_task(fetch_places())
        tasks[places_task] = "places"
        errors: dict[str, str] = {}
        completed: dict[str, Any] = {}

        try:
            yield _sse(
                "started",
                {
                    "destination": plan.destination,
                    "sources": ["weather", "places", "currency"],
                },
            )

            pending = set(tasks)
            while pending:
                finished, still_pending = await asyncio.wait(
                    pending,
                    timeout=15,
                    return_when=asyncio.FIRST_COMPLETED,
                )
                if not finished:
                    yield ": keep-alive\n\n"
                    continue
                pending = still_pending
                for task in finished:
                    source = tasks[task]
                    try:
                        result = task.result()
                    except Exception:
                        logger.exception("Failed to fetch %s data", source)
                        error_message = f"Failed to fetch {source} data."
                        errors[source] = error_message
                        yield _sse(
                            "source_error",
                            {"source": source, "error": error_message},
                        )
                    else:
                        completed[source] = result
                        yield _sse("update", {"source": source, "data": result})

            if errors and not completed:
                yield _sse(
                    "stream_error",
                    {"message": "All travel-plan sources failed.", "errors": errors},
                )
                return

            yield _sse(
                "complete",
                {
                    "message": "Travel plan stream completed.",
                    "destination": plan.destination,
                    "duration_days": trip_duration,
                    "errors": errors or None,
                },
            )
        finally:
            for task in tasks:
                if not task.done():
                    task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )