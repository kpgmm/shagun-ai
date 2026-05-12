from typing import Optional
import socketio

_sio: Optional[socketio.AsyncServer] = None


def set_sio(sio_instance: socketio.AsyncServer):
    global _sio
    _sio = sio_instance


async def emit_to_event_room(event_id: str, event_name: str, data: dict):
    """Emit a Socket.IO event to all clients in the given event's room."""
    if _sio:
        room = f"event_{event_id}"
        await _sio.emit(event_name, data, room=room)
