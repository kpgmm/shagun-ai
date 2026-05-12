"use client"

import { io, Socket } from "socket.io-client"

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:8000", {
      withCredentials: true,
      transports: ["websocket", "polling"],
      autoConnect: false,
    })
  }
  return socket
}

export function joinEventRoom(eventId: string): void {
  const s = getSocket()
  if (!s.connected) s.connect()
  s.emit("join_event_room", { event_id: eventId })
}

export function leaveEventRoom(eventId: string): void {
  const s = getSocket()
  s.emit("leave_event_room", { event_id: eventId })
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect()
  }
}
