# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shagun AI is a full-stack web app for managing digital gift money (shagun) at Indian social functions. It provides real-time payment tracking, guest management, activity scheduling, Razorpay UPI QR integration, and WhatsApp notifications via Twilio.

## Common Commands

### Backend (from `backend/`)
```bash
venv\Scripts\activate                                    # CMD (Windows)
python -m uvicorn main:app --reload --port 8000
```
> Use `python -m uvicorn` (not the `uvicorn` executable directly) — the `.exe` launcher has the original venv path baked in and will fail if the project has been moved.

### Frontend (from `frontend/`)
```bash
npm run dev       # http://localhost:3000
npm run build     # Production build (TypeScript check included)
npm run lint      # ESLint
```

No test suite exists yet.

## Architecture

### ASGI Layering
Socket.IO wraps FastAPI as the **outermost ASGI layer**:
```python
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)
```
All WebSocket handshakes go through Socket.IO before FastAPI sees them. The FastAPI instance is registered as `other_asgi_app`, not the top-level app. Import and run `main.app`, not `main.fastapi_app`.

### Authentication Flow
- JWT stored in **httpOnly cookie** named `access_token` (SameSite=Lax for dev)
- Backend: `get_current_user()` dependency in `middleware/auth.py` decodes JWT from cookie and returns a user dict
- Frontend: all `fetch` calls use `credentials: "include"`; the dashboard layout (`app/(dashboard)/layout.tsx`) does a server-side fetch to `/api/auth/me` using `cookies()` and redirects to `/login` on 401

### API Response Contract
All endpoints return `{ "success": true/false, "data": {...} }` or `{ "success": false, "error": "message" }`. The frontend `lib/api.ts` client throws `ApiError` if `success === false`.

### Real-Time Updates
Entries page uses Socket.IO rooms named `event_{event_id}`. When an entry is created, updated, or deleted, `emit_to_event_room()` in `services/socket_manager.py` pushes one of three events: `new_entry`, `entry_updated`, or `entry_deleted`. The frontend `components/dashboard/live-feed.tsx` listens on this room via `joinEventRoom(eventId)` / `leaveEventRoom(eventId)` on mount/unmount.

The socket client (`lib/socket.ts`) is a lazy singleton — it is **not** connected on import. It connects only when `joinEventRoom` is first called.

`LiveFeed` accepts an optional `activityId` prop; when set (activity detail page), it pre-filters entries to that activity and hides the activity filter dropdown.

### Razorpay Webhook
- **Critical**: `await request.body()` must be called before any JSON parsing — the raw bytes are required for HMAC-SHA256 signature verification against `X-Razorpay-Signature`.
- The `event_id` is embedded in Razorpay QR code `notes` at QR creation time (`services/razorpay.py`), then read back from `payload.notes.event_id` in the webhook to route the payment to the correct event.
- Idempotency is enforced by checking `razorpay_payment_id` before inserting — duplicate webhooks are silently skipped.
- Only `payment.captured` events create entries; all others return `handled: false`.

### WhatsApp RSVP
Incoming Twilio messages at `POST /api/webhooks/whatsapp` are parsed for RSVP intent:
- **Coming**: `HAAN`, `YES`, `1`, `HA`, `HAN`
- **Not coming**: `NA`, `NO`, `2`, `NAHI`

Unrecognised replies are silently ignored. Guest lookup uses `invite_sent: true` and sorts by `invite_sent_at` descending to handle guests across multiple events.

### WhatsApp Confirmation
`_send_confirmation_and_flag(entry_id, entry, event)` in `routers/entries.py` sends a WhatsApp payment confirmation and sets `confirmation_sent: True` in the DB on success. It is called as a `BackgroundTask` from both:
- `POST /api/events/{event_id}/entries` (manual entry creation, when phone is present)
- `POST /api/webhooks/razorpay` (Razorpay webhook, imported from `routers.entries`)

### External HTTP Calls
The Razorpay Python SDK is **synchronous** — do not use it directly in async handlers. All Razorpay and Twilio calls use `httpx.AsyncClient` directly with Basic Auth (`services/razorpay.py`, `services/whatsapp.py`).

### Database
Motor (async MongoDB driver) via five collections: `users`, `events`, `guests`, `entries`, `activities`. Indexes are created at startup in `database.create_indexes()`:
- `users.phone` — unique
- `events.user_id`
- `guests.(event_id, phone)` — used for webhook phone matching
- `entries.event_id`
- `entries.activity_id` — activity-scoped entry queries
- `activities.event_id`
- `activities.(event_id, status)` — compound index for status-filtered lookups

### Activities
Activities represent sub-events within an event (e.g. Mehndi, Garba, Wedding). Each activity has:
- `type` — one of the fixed literals in `schemas/activity.py` (`ActivityType`), or `"custom"` with a `custom_type_name`
- `status` — `"upcoming"` | `"active"` | `"completed"` (managed via `PATCH .../status`)
- `guest_ids` — list of ObjectIds of guests assigned to that activity (not enforced as a restriction, just informational)
- `date` / `time` — scheduled date and optional time string

Entries can be linked to an activity via `activity_id` (optional). If provided at entry creation, the backend validates the activity belongs to the same event. Activity deletion is blocked if any non-deleted entries reference it.

The list activities endpoint (`GET /api/events/{event_id}/activities`) returns aggregated `entry_count` and `entry_total` via a MongoDB aggregation pipeline join.

### Entry Edit / Delete (Live Feed)
The live feed table (`components/dashboard/entry-row-actions.tsx`) renders inline edit and delete buttons on every row. Edit opens a dialog with React Hook Form + Zod; delete requires a `delete_reason` string before confirming. Both update TanStack Query cache optimistically and invalidate `entries-summary`.

### Payment Modes
Three modes are supported: `"cash"`, `"upi"`, `"gift"`.

- **Cash / UPI**: amount is required and must be > 0. UPI entries may include an optional `utr_number`.
- **Gift**: amount is optional (defaults to 0). A `gift_item` string (description of what was given, e.g. "Gold ring", "Saree") is the primary field. Gift amounts are included in all financial totals when > 0. The `entries_summary` endpoint returns `count_gift` and `total_gift` alongside the existing UPI/cash fields. Gift entries appear in the live feed with a purple "GIFT" badge; when amount > 0 the cell shows `₹100 · Saree`.

Cross-field validation in `CreateEntryRequest` uses a Pydantic `model_validator(mode="after")` to enforce amount > 0 only for non-gift modes.

### Guest Invitations
Three invitation flows exist:

1. **Bulk send** — `POST /api/events/{event_id}/guests/send-invites` — sends to all uninvited guests by default. Accepts an optional JSON body `{ "guest_ids": [...] }` to restrict to specific guests.
2. **Individual send** — `POST /api/events/{event_id}/guests/{guest_id}/send-invite` — queues a single invite as a background task and sets `invite_sent: True` on success.
3. **Selection-based send** — frontend `GuestsTable` renders checkboxes on every row with a "Select All" header (supports indeterminate state via ref). When any guests are selected, a contextual action bar appears with "Send Invites (N)" which calls the bulk endpoint with the selected `guest_ids`.

### Guest Import
`POST /api/events/{event_id}/guests/import` copies guests from a source event into the target event. Requires `source_event_id` and an optional `guest_ids` list (omit to import all). Duplicate phones are skipped; RSVP is reset to `"pending"` on all imported guests.

Frontend: `GuestImportDialog` (`components/guests/guest-import-dialog.tsx`) — a reusable dialog with an event dropdown and a checkable guest list (all selected by default). Wired into:
- **Guests page** — "Import from Event" button
- **New event creation** — dialog opens automatically after event + activities are created; "Skip" navigates to the event dashboard

`useEffect` dependency in `GuestImportDialog` uses the raw TanStack Query `data` reference (not a `= []` default) to avoid the infinite re-render loop that `data: guests = []` would cause.

### Reports
`GET /api/events/{event_id}/report/pdf` — event-wide PDF report (ReportLab Platypus):
- Event details, financial summary box (Total / UPI / Cash / Entries; Gifts box when present), RSVP summary, full entries table

`GET /api/events/{event_id}/activities/{activity_id}/report/pdf` — per-activity PDF report:
- Activity details, financial summary, entries table

PDF styling: white background, red (#CC2200) headings, green (#16A34A) amounts, light gray (#D1D5DB) grid. Font registration tries Arial (Windows) → DejaVuSans (Linux) → Helvetica fallback for ₹ symbol support. Gift entries show `gift_item` in the Amount column; gift entries with amounts are included in financial totals; a "Gifts" stat cell is added when any gift entries exist.

### Data Conventions
- **Phones**: stored as 10-digit strings (strip `+91`, spaces, non-digits everywhere). Phone is unique per event in the `guests` collection (not globally).
- **Soft deletes**: entries are never hard-deleted; set `deleted_at` + `delete_reason`. All entry list queries must filter `deleted_at: None`. Deletion requires a `delete_reason` string in the request body.
- **ObjectId**: MongoDB `_id` is always serialized to string `id` in responses.
- **`logged_by`**: `"operator"` for manually entered entries, `"razorpay_webhook"` for webhook-created entries.
- **Activities hard delete**: activities are hard-deleted (no soft delete), but only allowed when `entry_count == 0`.

### Frontend State
- TanStack Query v5 handles all server state (30s stale time, skip retry on 401)
- React Hook Form + Zod for all forms; cross-field validation uses `superRefine` for mode-dependent amount rules
- Sonner for toast notifications
- Route groups: `(auth)` for `/login` and `/register`; `(dashboard)` for everything else — the dashboard layout handles server-side auth redirect

## Key Files to Read First

When touching a feature area, read these files together:

| Feature | Backend | Frontend |
|---------|---------|----------|
| Auth | `middleware/auth.py`, `routers/auth.py` | `app/(auth)/login/page.tsx`, `app/(dashboard)/layout.tsx` |
| Events | `routers/events.py`, `services/razorpay.py` | `app/(dashboard)/events/`, `components/events/` |
| Entries (live) | `routers/entries.py`, `services/socket_manager.py` | `app/(dashboard)/events/[eventId]/page.tsx`, `components/dashboard/live-feed.tsx`, `components/dashboard/entry-row-actions.tsx` |
| Activities | `routers/activities.py`, `models/activity.py`, `schemas/activity.py` | `app/(dashboard)/events/[eventId]/activities/`, `components/activities/`, `types/activity.ts` |
| Guests / RSVP / Invites | `routers/guests.py`, `routers/webhooks.py` | `app/(dashboard)/events/[eventId]/guests/page.tsx`, `components/guests/` |
| Webhooks | `routers/webhooks.py`, `services/whatsapp.py` | N/A |
| Reports | `routers/reports.py`, `services/report_generator.py` | `app/(dashboard)/events/[eventId]/report/page.tsx` |

## Known Gaps / Not Yet Implemented

- **WhatsApp Report Delivery** — report page button fires `toast.info` stub; no `POST /api/events/{event_id}/report/whatsapp` endpoint exists
- **Razorpay QR close on event completion** — `close_upi_qr()` in `services/razorpay.py` is implemented but never called when event status → `"completed"`
- **Event edit UI** — `PATCH /api/events/{event_id}` exists on backend; no edit form in the frontend event dashboard
- **Cookie `secure` flag** — hardcoded `False` in `routers/auth.py`; must be set `True` in production
- **Offline entry queuing** — offline banner shown on entry page but form submission has no local queue/retry
- **`QrDisplay` component** — fully built (`components/events/qr-display.tsx`) but not imported anywhere; event dashboard uses a plain `<a>` link instead
- **Pagination / search** — no pagination or server-side search on entries or guests lists

## Environment Setup

**`backend/.env`** (required):
```
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=shagun_db
JWT_SECRET=<64-char random string>
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
FRONTEND_URL=http://localhost:3000
```

**`frontend/.env.local`** (required):
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SOCKET_URL=http://localhost:8000
```

## Dependency Constraint

motor 3.6.0 requires `pymongo>=4.9,<4.10`. Do **not** upgrade pymongo to 4.10.x — it breaks motor's internal API.
