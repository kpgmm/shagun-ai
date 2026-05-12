# Shagun AI

A full-stack web app for managing digital gift money (shagun) at Indian social functions. Track payments in real-time, manage guest lists, collect UPI payments via Razorpay QR codes, and send WhatsApp notifications via Twilio.

## Features

- **Real-time payment tracking** — Live dashboard updates via Socket.IO when payments come in
- **Guest management** — Add guests individually or bulk-import via Excel; track RSVP status
- **Razorpay UPI QR** — Auto-generated QR code per event; payments are recorded automatically via webhook
- **WhatsApp notifications** — Send invites to guests and payment confirmations via Twilio
- **Excel reports** — Export full ledger, summary, and village-wise breakdown as a spreadsheet
- **Soft deletes** — Entries are never hard-deleted; full audit trail is preserved

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, Python-SocketIO, Motor (async MongoDB) |
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui |
| Database | MongoDB |
| Payments | Razorpay UPI QR |
| Messaging | Twilio WhatsApp API |
| Auth | JWT in httpOnly cookie |

## Prerequisites

- Python 3.12+
- Node.js 18+
- MongoDB (running locally on port 27017)
- Razorpay account (for UPI QR and webhooks)
- Twilio account (for WhatsApp messaging)

## Setup

### 1. Clone and configure environment

**Backend** — create `backend/.env`:
```env
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=shagun_db
JWT_SECRET=<64-char random string>
JWT_EXPIRE_MINUTES=10080
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
FRONTEND_URL=http://localhost:3000
```

**Frontend** — create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SOCKET_URL=http://localhost:8000
```

### 2. Install dependencies

```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate       # Windows CMD
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### 3. Run the servers

```bash
# Backend (from backend/)
venv\Scripts\activate
python -m uvicorn main:app --reload --port 8000

# Frontend (from frontend/)
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

## Project Structure

```
shagun-ai/
├── backend/
│   ├── main.py               # FastAPI + Socket.IO ASGI entry point
│   ├── config.py             # Environment config (Pydantic Settings)
│   ├── database.py           # Motor async MongoDB connection
│   ├── middleware/auth.py    # JWT auth dependency
│   ├── models/               # MongoDB document templates
│   ├── schemas/              # Pydantic request/response validators
│   ├── routers/              # API route handlers
│   │   ├── auth.py           # Register, login, logout
│   │   ├── events.py         # Event CRUD + Razorpay QR
│   │   ├── guests.py         # Guest management + bulk import
│   │   ├── entries.py        # Payment entries + soft delete
│   │   ├── webhooks.py       # Razorpay & WhatsApp webhooks
│   │   └── reports.py        # Excel report export
│   └── services/
│       ├── razorpay.py       # Razorpay UPI QR API (httpx)
│       ├── whatsapp.py       # Twilio WhatsApp API (httpx)
│       ├── socket_manager.py # Socket.IO room emission
│       └── report_generator.py # openpyxl Excel builder
└── frontend/
    ├── app/
    │   ├── (auth)/           # Login & register pages
    │   └── (dashboard)/      # Protected event/guest/entry/report pages
    ├── components/           # UI components by feature
    ├── lib/
    │   ├── api.ts            # Typed fetch API client
    │   └── socket.ts         # Socket.IO client + room helpers
    └── types/index.ts        # Shared TypeScript interfaces
```

## Razorpay Webhook Setup

Point your Razorpay webhook to:
```
POST https://<your-domain>/api/webhooks/razorpay
```
Enable the `payment.captured` event and set the webhook secret in `backend/.env`.

## WhatsApp (Twilio) Webhook Setup

Point your Twilio WhatsApp inbound webhook to:
```
POST https://<your-domain>/api/webhooks/whatsapp
```
Guests reply **HAAN** (coming) or **NA** (not coming) to update their RSVP status automatically.
