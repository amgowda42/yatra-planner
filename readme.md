# Yatra Planner

Yatra Planner is a travel-planning app with a FastAPI backend and a Next.js
frontend. Submit a destination and trip dates to gather weather, local places,
and a currency conversion in one view. Plans can be returned together or
streamed source-by-source.

## Features

- Create a trip plan with a destination, start and end dates, base currency, and
  amount.
- View a weather forecast, recommended places, and a conversion from the
  selected currency to USD.
- Choose a standard response or watch streaming results arrive progressively.
- Check the backend connection/version, view active cache entries, and clear
  the in-memory cache from the frontend.
- Browse the interactive FastAPI documentation at `/docs`.

## Project layout

```text
app/
  main.py                 FastAPI application and API overview
  models.py               Request and response models
  routes/
    planner.py            Standard planning and cache endpoints
    steamy.py             Server-Sent Events planning endpoint
  services/
    cache.py              In-memory expiring cache
    currency.py           Currency conversion service
    places.py             Local destination places
    weather.py            Weather service
view/
  app/                    Next.js application and API proxy routes
  lib/                    Frontend API types and proxy helper
```

## Requirements

- Python 3.10 or later
- Node.js 20.9 or later and npm

## Run locally

### 1. Start the FastAPI backend

From the repository root, create and activate a virtual environment, then
install the backend dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install fastapi uvicorn httpx
```

On macOS or Linux, activate the environment with:

```bash
source .venv/bin/activate
```

Start the API from the repository root:

```bash
uvicorn app.main:app --reload
```

The API is available at [http://127.0.0.1:8000](http://127.0.0.1:8000).
Interactive documentation is at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

### 2. Start the Next.js frontend

In another terminal:

```powershell
cd view
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The frontend forwards
requests through same-origin Next.js routes to `http://127.0.0.1:8000` by
default, so browser requests do not depend on FastAPI CORS configuration.

To use a different backend origin, set `YATRA_API_BASE_URL` in the environment
where Next.js runs, before starting the frontend:

```powershell
$env:YATRA_API_BASE_URL = "http://127.0.0.1:8000"
npm run dev
```

```bash
YATRA_API_BASE_URL=http://127.0.0.1:8000 npm run dev
```

See [view/README.md](./view/README.md) for frontend-specific instructions.

## API reference

All routes are served by the FastAPI backend. `GET /` returns the API version,
description, and route list.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | API welcome message, version, and endpoint list |
| `POST` | `/plan/` | Return an aggregated travel plan |
| `POST` | `/plan/stream` | Stream source results as Server-Sent Events |
| `GET` | `/plan/cache-stats` | Get the number of active cache entries |
| `DELETE` | `/plan/` | Clear the in-memory travel-data cache |

### Create a plan

Send a JSON body to `POST /plan/`:

```json
{
  "destination": "Goa",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "base_currency": "INR",
  "amount": 10000
}
```

Replace the date placeholders with valid future dates. `base_currency` defaults
to `INR` and `amount` defaults to `1.0`. The trip must be at least one day and
no longer than 30 days.

The response contains the destination, trip duration, weather, places, and
currency result. An individual upstream failure is returned in `errors` while
the other available results are preserved. The API returns `502` if all three
data sources fail.

### Stream a plan

Send the same request body to `POST /plan/stream`. The response uses
`text/event-stream` and emits:

- `started` when the request begins
- `update` when a `weather`, `places`, or `currency` source completes
- `source_error` when one source fails
- `complete` when the stream finishes with at least one successful source
- `stream_error` if all sources fail

For example, with `curl`, use `-N` to disable response buffering:

```bash
curl -N http://127.0.0.1:8000/plan/stream \
  -H "Content-Type: application/json" \
  -d '{"destination":"Goa","start_date":"2030-01-01","end_date":"2030-01-04","base_currency":"INR","amount":10000}'
```

Use dates in the future when running the example.

### Cache management

`GET /plan/cache-stats` returns a JSON object such as:

```json
{
  "entries": 2
}
```

The cache is in memory and currently stores weather and currency results. Those
entries expire after one hour. `DELETE /plan/` clears the cache for the running
backend process; it does not delete saved trips, since plans are not persisted.

## Frontend checks

Run these commands from `view/`:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

The production frontend can be started with `npm start` after building.

## Data source notes

Places are provided by the local destination dataset in `app/services/places.py`.
Weather and currency results depend on their upstream providers and may be
unavailable; the planner reports source errors and can still show partial
results.