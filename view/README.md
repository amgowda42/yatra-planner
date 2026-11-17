# Yatra Planner frontend

This Next.js app provides a single-page interface for creating travel plans with the FastAPI backend. It supports both the standard plan response and progressive updates from the streaming endpoint.

## Run locally

Start the FastAPI app from the repository root:

```bash
uvicorn app.main:app --reload
```

In `view/`, install dependencies and start Next.js:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The frontend forwards requests through same-origin Next.js routes to `http://127.0.0.1:8000` by default. To use a different backend origin, set `YATRA_API_BASE_URL` in the environment where Next.js runs.

The planner uses `POST /plan/` for the standard mode and `POST /plan/stream` for streamed updates.
It also reads `GET /` to show backend connection/version details, uses
`GET /plan/cache-stats` to display active cache entries, and provides a cache
clear action through `DELETE /plan/`.
