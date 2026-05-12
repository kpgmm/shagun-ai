import socketio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from database import connect_db, disconnect_db, create_indexes
from services.socket_manager import set_sio

# ── Socket.IO server (async ASGI mode) ────────────────────────────────────────
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.FRONTEND_URL,
    logger=False,
    engineio_logger=False,
)

# Register the sio instance so any router can emit events
set_sio(sio)


# ── Socket.IO event handlers ──────────────────────────────────────────────────
@sio.event
async def connect(sid, environ, auth):
    print(f"[Socket.IO] Client connected: {sid}")


@sio.event
async def disconnect(sid):
    print(f"[Socket.IO] Client disconnected: {sid}")


@sio.event
async def join_event_room(sid, data):
    """Client calls this after connecting to subscribe to a specific event's room."""
    event_id = data.get("event_id") if isinstance(data, dict) else None
    if event_id:
        room = f"event_{event_id}"
        await sio.enter_room(sid, room)
        await sio.emit("room_joined", {"event_id": event_id, "room": room}, to=sid)
        print(f"[Socket.IO] {sid} joined room {room}")


@sio.event
async def leave_event_room(sid, data):
    event_id = data.get("event_id") if isinstance(data, dict) else None
    if event_id:
        await sio.leave_room(sid, f"event_{event_id}")


# ── FastAPI app ───────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await create_indexes()
    yield
    await disconnect_db()


fastapi_app = FastAPI(
    title="Shagun API",
    description="Digital shagun management system for Gujarati Hindu social functions",
    version="1.0.0",
    lifespan=lifespan,
)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global exception handler ──────────────────────────────────────────────────
@fastapi_app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": str(exc)},
    )


# ── Routers (imported lazily to avoid circular imports during scaffolding) ────
from routers import auth, events, guests, entries, webhooks, reports, activities  # noqa: E402

fastapi_app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
fastapi_app.include_router(events.router, prefix="/api/events", tags=["Events"])
fastapi_app.include_router(guests.router, prefix="/api", tags=["Guests"])
fastapi_app.include_router(entries.router, prefix="/api", tags=["Entries"])
fastapi_app.include_router(activities.router, prefix="/api", tags=["Activities"])
fastapi_app.include_router(webhooks.router, prefix="/api/webhooks", tags=["Webhooks"])
fastapi_app.include_router(reports.router, prefix="/api", tags=["Reports"])


@fastapi_app.get("/", tags=["Health"])
async def root():
    return {"success": True, "data": {"message": "Shagun API is running"}}


# ── ASGI app: Socket.IO wraps FastAPI ─────────────────────────────────────────
# Run with: uvicorn main:app --reload --port 8000
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)
