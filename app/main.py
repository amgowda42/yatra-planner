from fastapi import FastAPI

try:
    from app.routes.planner import router as planner_router
    from app.routes.steamy import router as steamy_router
except ModuleNotFoundError:  # pragma: no cover - allows running the app from the app directory
    from routes.planner import router as planner_router
    from routes.steamy import router as steamy_router

app = FastAPI(
    title="Yatra Planner",
    description="Aggregate data from multiple sources to provide a single view with SSE support.",
    version="1.0.0",
)

@app.get("/")
async def root():
    return {"message": "Welcome to Yatra Planner!",
            "version": "1.0.0",
            "description": "Aggregate data from multiple sources to provide a single view with SSE support.",
            "API endpoints":{
                "POST /plan": "Create a new travel plan(Aggregate)",
                "POST /plan/stream": "Stream the travel plan data (SSE)",
                "GET /plan/cache-stats": "Get cache statistics for the travel plan data",
                "DELETE /plan": "Clear cached travel plan data",
            }}

app.include_router(planner_router)
app.include_router(steamy_router)