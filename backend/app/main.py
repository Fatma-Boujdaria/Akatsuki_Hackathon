"""FastAPI application: creates the app, wires routers, CORS and error logging.

Run it with:  uvicorn app.main:app --reload   (from the backend/ folder)
Interactive API docs: http://localhost:8000/docs
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.middleware.cors import CORSMiddleware

from app import monitor
from app.config import get_settings
from app.db import Base, get_engine
from app.routers import (
    admin,
    alerts,
    appliances,
    assistant,
    auth,
    dashboard,
    demo,
    households,
    notifications,
    readings,
    settings,
    support,
    tariffs,
    tips,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("tranche_guard")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    engine = get_engine()
    if engine.dialect.name == "sqlite":
        # Local quick start: create the tables. On Supabase the SQL migrations do it.
        Base.metadata.create_all(engine)
    log.info("database: %s", engine.dialect.name)
    yield


def create_app() -> FastAPI:
    config = get_settings()
    app = FastAPI(
        title="Tranche Guard API",
        version="1.0.0",
        description="Electricity and water monitoring, STEG tranche forecast and alerts. "
        "Every bill figure is an estimate.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origin_list,
        allow_credentials=False,  # the token travels in the Authorization header, not cookies
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-Device-Key", "X-Household-Id"],
    )

    @app.middleware("http")
    async def count_requests(request: Request, call_next):
        # Counters for the admin "System" screen (in memory, this process only).
        monitor.incr("requests")
        try:
            response = await call_next(request)
        except Exception as exc:
            monitor.incr("errors_5xx")
            monitor.error(f"{request.method} {request.url.path}: {type(exc).__name__}")
            raise
        if response.status_code >= 500:
            monitor.incr("errors_5xx")
            monitor.error(f"{request.method} {request.url.path} -> {response.status_code}")
        return response

    @app.exception_handler(RequestValidationError)
    async def log_rejected_payloads(request: Request, exc: RequestValidationError):
        # "A reading that fails validation is rejected with 422 and logged."
        if request.url.path == "/api/readings":
            log.warning("reading rejected (422): %s", exc.errors())
            monitor.incr("readings_rejected")
        return await request_validation_exception_handler(request, exc)

    @app.get("/api/health", tags=["health"])
    def health() -> dict:
        return {"status": "ok", "demo_mode": config.demo_mode}

    for module in (
        auth,
        readings,
        dashboard,
        alerts,
        tips,
        settings,
        tariffs,
        demo,
        households,
        appliances,
        assistant,
        notifications,
        support,
        admin,
    ):
        app.include_router(module.router)
    return app


app = create_app()
