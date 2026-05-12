# Remaining Features & Implementation Gaps

## Remaining Features

- **Entry Edit UI**
  - Status: Not implemented on frontend
  - Related Files: `backend/routers/entries.py` (PUT endpoint exists), `frontend/components/dashboard/live-feed.tsx`, `frontend/app/(dashboard)/events/[eventId]/entry/page.tsx`
  - Missing Parts: No edit button or edit form in live feed or entry page; backend `PUT /api/events/{event_id}/entries/{entry_id}` is unreachable from UI

- **Entry Delete UI**
  - Status: Not implemented on frontend
  - Related Files: `backend/routers/entries.py` (DELETE endpoint exists), `frontend/components/dashboard/live-feed.tsx`
  - Missing Parts: No delete action in live feed table; backend soft-delete endpoint is unreachable from UI

- **Event Edit UI**
  - Status: Not implemented on frontend
  - Related Files: `backend/routers/events.py` (PATCH endpoint exists), `frontend/app/(dashboard)/events/[eventId]/page.tsx`
  - Missing Parts: `Pencil` icon is imported in event dashboard page but no edit button or form rendered; `PATCH /api/events/{event_id}` is unreachable from UI

- **Razorpay QR Close on Event Completion**
  - Status: Backend function implemented, never called
  - Related Files: `backend/services/razorpay.py` (`close_upi_qr`), `backend/routers/events.py` (`update_event_status`)
  - Missing Parts: `close_upi_qr(event["razorpay_qr_id"])` not called when event status changes to `completed`

- **WhatsApp Report Delivery**
  - Status: UI button is a stub; no backend endpoint
  - Related Files: `frontend/app/(dashboard)/events/[eventId]/report/page.tsx:141-145`
  - Missing Parts: No `POST /api/events/{event_id}/report/whatsapp` endpoint; frontend button calls `toast.info(...)` instead of API

- **`confirmation_sent` Flag Update**
  - Status: Field exists in schema, always stays `False`
  - Related Files: `backend/models/entry.py`, `backend/services/whatsapp.py` (`send_confirmation`), `backend/routers/webhooks.py`
  - Missing Parts: After `send_confirmation` succeeds, `entries` collection is never updated with `confirmation_sent: True`

- **Offline Entry Queuing**
  - Status: Offline UI indicator exists, queuing not implemented
  - Related Files: `frontend/app/(dashboard)/events/[eventId]/entry/page.tsx`
  - Missing Parts: Offline banner shown, but form submission has no local queue/retry — entries are silently lost if submitted offline

- **QrDisplay Component Integration**
  - Status: Component fully built, never rendered
  - Related Files: `frontend/components/events/qr-display.tsx`, `frontend/app/(dashboard)/events/[eventId]/page.tsx`
  - Missing Parts: Event dashboard uses a plain `<a>` link to open QR URL; `QrDisplay` component with print capability is not imported or used anywhere

---

## Feature List

### Implemented
- User registration and login (phone + password, bcrypt)
- JWT auth via httpOnly cookie, 7-day expiry
- Dashboard layout with server-side auth redirect
- Event creation with Razorpay UPI QR generation
- Event status lifecycle (`draft` → `active` → `completed`)
- Manual entry recording (cash/UPI, amount presets, guest autocomplete)
- Real-time live entry feed (Socket.IO rooms, `new_entry` / `entry_updated` / `entry_deleted` events)
- Entry summary (total, UPI/cash breakdown via MongoDB aggregation)
- Guest add / edit / delete (single)
- Bulk guest import via Excel/CSV with column mapping and deduplication
- Guest filter by relation side and RSVP status
- WhatsApp invite sending (bulk, uninvited-only option)
- RSVP via WhatsApp reply keyword parsing (`HAAN`/`YES`/`NA`/`NO` etc.)
- WhatsApp RSVP acknowledgment
- Razorpay payment webhook → auto entry creation + WhatsApp payment confirmation trigger
- Webhook idempotency check on `razorpay_payment_id`
- Excel report generation (3 sheets: Full Ledger, Summary, Village Summary)
- RSVP summary (API + event dashboard card + report page)
- QR code print-to-PDF component (`QrDisplay`)

### Partial
- WhatsApp payment confirmation (`send_confirmation` called but `confirmation_sent` flag never updated)
- Event dashboard edit action (backend PATCH endpoint ready, no frontend UI)
- Entry edit and delete actions (backend endpoints ready, no frontend UI)
- Razorpay QR lifecycle (`close_upi_qr` implemented, not wired to event completion)
- Excel bulk upload (preview capped at 100 rows client-side, full dataset sent to backend)
- Report page WhatsApp send button (renders but calls `toast.info` stub, no backend endpoint)
- Cookie `secure` flag (hardcoded `False`, comment says set `True` in production)

### Not Implemented
- Password reset / forgot password (no endpoint, no UI)
- User profile update (name/phone/password)
- Event deletion
- Pagination on entries list or guests list
- Search by name or phone on entries or guests
- Offline entry queuing/retry
- WhatsApp report delivery endpoint and wiring

---

## Missing Connections

- **Razorpay QR Close ↔ Event Completion**
  - Type: Internal service call
  - Missing Implementation: `close_upi_qr(event["razorpay_qr_id"])` not invoked in `update_event_status` when `status == "completed"`
  - Related Files: `backend/routers/events.py:109-129`, `backend/services/razorpay.py:51-66`

- **Entry Edit/Delete ↔ Frontend UI**
  - Type: Frontend ↔ Backend integration
  - Missing Implementation: No UI triggers for `PUT /api/events/{event_id}/entries/{entry_id}` or `DELETE /api/events/{event_id}/entries/{entry_id}`
  - Related Files: `backend/routers/entries.py:99-157`, `frontend/components/dashboard/live-feed.tsx`

- **Event Edit ↔ Frontend UI**
  - Type: Frontend ↔ Backend integration
  - Missing Implementation: No UI triggers for `PATCH /api/events/{event_id}`
  - Related Files: `backend/routers/events.py:79-106`, `frontend/app/(dashboard)/events/[eventId]/page.tsx`

- **`confirmation_sent` Flag ↔ WhatsApp Service**
  - Type: Database write after third-party call
  - Missing Implementation: No `db.entries.update_one({"_id": doc["_id"]}, {"$set": {"confirmation_sent": True}})` after successful `send_confirmation`
  - Related Files: `backend/services/whatsapp.py:63-76`, `backend/routers/webhooks.py:129-131`

- **WhatsApp Report Send ↔ Backend Endpoint**
  - Type: Frontend ↔ Backend integration (endpoint absent)
  - Missing Implementation: No `POST /api/events/{event_id}/report/whatsapp` route; frontend button fires `toast.info` only
  - Related Files: `frontend/app/(dashboard)/events/[eventId]/report/page.tsx:137-145`, `backend/routers/reports.py`

- **QrDisplay Component ↔ Event Dashboard**
  - Type: Frontend component connection
  - Missing Implementation: `QrDisplay` not imported or used in event dashboard; replaced by a plain anchor link
  - Related Files: `frontend/components/events/qr-display.tsx`, `frontend/app/(dashboard)/events/[eventId]/page.tsx:149-164`

- **Cookie `secure` Flag ↔ Production HTTPS**
  - Type: Environment/config dependency
  - Missing Implementation: `secure=False` hardcoded — no env-based toggle
  - Related Files: `backend/routers/auth.py:65`

- **`next.config.ts` ↔ Production Configuration**
  - Type: Environment/config dependency
  - Missing Implementation: Config is empty — no `images.remotePatterns` for Razorpay QR image URLs, no rewrites, no production-specific settings
  - Related Files: `frontend/next.config.ts`

---

## TODO / Placeholder Detection

- **`frontend/app/(dashboard)/events/[eventId]/report/page.tsx:141`**
  - Issue: `onClick={() => toast.info("WhatsApp delivery requires Twilio configuration")}` — Send to WhatsApp button is a non-functional stub

- **`backend/services/whatsapp.py:5`**
  - Issue: Module docstring states "Will be fully implemented in Phase 9." — stale comment; service is implemented but signals planned/phased work

- **`backend/routers/auth.py:65`**
  - Issue: `secure=False  # Set True in production with HTTPS` — production security setting is a manual step with no env-gate

- **`frontend/next.config.ts`**
  - Issue: Completely empty config object — no production settings, image domains, or CORS rewrites defined

- **`frontend/app/(dashboard)/events/[eventId]/page.tsx:8`**
  - Issue: `Pencil` imported from `lucide-react` but not used anywhere in the component — dead import indicating planned edit event UI

- **`backend/services/razorpay.py:51-66` (`close_upi_qr`)**
  - Issue: Function is fully implemented but has zero call sites — dead code relative to current app flow

- **`frontend/components/events/qr-display.tsx`**
  - Issue: Full component with print functionality built but has zero import sites across the codebase — unused module
