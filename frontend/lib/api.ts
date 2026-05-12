const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include", // sends httpOnly cookie cross-origin
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  const json = await res.json()

  if (!json.success) {
    throw new ApiError(res.status, json.error ?? "An error occurred")
  }

  return json.data as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "DELETE",
      body: body ? JSON.stringify(body) : undefined,
    }),
}

// ── Entry API helpers ──────────────────────────────────────────────────────

import type { Entry } from "@/types"

export const updateEntry = (eventId: string, entryId: string, data: unknown) =>
  api.put<Entry>(`/api/events/${eventId}/entries/${entryId}`, data)

export const deleteEntry = (eventId: string, entryId: string, deleteReason: string) =>
  api.delete<{ deleted: boolean }>(`/api/events/${eventId}/entries/${entryId}`, {
    delete_reason: deleteReason,
  })

// ── Activity API helpers ───────────────────────────────────────────────────

import type { Activity, ActivityDetail } from "@/types/activity"

export const getActivities = (eventId: string) =>
  api.get<Activity[]>(`/api/events/${eventId}/activities`)

export const createActivity = (eventId: string, data: unknown) =>
  api.post<Activity>(`/api/events/${eventId}/activities`, data)

export const updateActivity = (eventId: string, activityId: string, data: unknown) =>
  api.patch<Activity>(`/api/events/${eventId}/activities/${activityId}`, data)

export const updateActivityStatus = (eventId: string, activityId: string, status: string) =>
  api.patch<Activity>(`/api/events/${eventId}/activities/${activityId}/status`, { status })

export const deleteActivity = (eventId: string, activityId: string) =>
  api.delete<{ deleted: boolean }>(`/api/events/${eventId}/activities/${activityId}`)

export const getActivityDetail = (eventId: string, activityId: string) =>
  api.get<ActivityDetail>(`/api/events/${eventId}/activities/${activityId}`)

export const addActivityGuests = (eventId: string, activityId: string, guestIds: string[]) =>
  api.post<Activity>(`/api/events/${eventId}/activities/${activityId}/guests`, { guest_ids: guestIds })

export const removeActivityGuest = (eventId: string, activityId: string, guestId: string) =>
  api.delete<Activity>(`/api/events/${eventId}/activities/${activityId}/guests/${guestId}`)

// ── Guest API helpers ──────────────────────────────────────────────────────

export const getEvents = () =>
  api.get<import("@/types").Event[]>("/api/events")

export const importGuests = (
  targetEventId: string,
  sourceEventId: string,
  guestIds?: string[],
) =>
  api.post<{ imported: number; skipped: number }>(
    `/api/events/${targetEventId}/guests/import`,
    { source_event_id: sourceEventId, guest_ids: guestIds ?? null },
  )

export function downloadEventReport(eventId: string): void {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
  window.open(`${baseUrl}/api/events/${eventId}/report/pdf`, "_blank")
}

export function downloadActivityReport(eventId: string, activityId: string): void {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
  window.open(`${baseUrl}/api/events/${eventId}/activities/${activityId}/report/pdf`, "_blank")
}
