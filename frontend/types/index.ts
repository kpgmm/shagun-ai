export interface User {
  id: string
  name: string
  phone: string
  created_at: string
}

export type EventType = "wedding" | "naamkaran" | "griha_pravesh" | "puja" | "other"
export type EventStatus = "draft" | "active" | "completed"

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  wedding: "Wedding (Vivah)",
  naamkaran: "Naamkaran",
  griha_pravesh: "Griha Pravesh",
  puja: "Puja",
  other: "Other",
}

export interface Event {
  id: string
  user_id: string
  name: string
  type: EventType
  event_date: string
  host_name: string
  host_village: string
  host_upi_id: string
  host_whatsapp: string
  razorpay_qr_id?: string
  razorpay_qr_image_url?: string
  status: EventStatus
  created_at: string
}

export type RelationSide = "mama_pakkhu" | "kaka_pakkhu" | "friend" | "colleague" | "other"
export type RsvpStatus = "pending" | "coming" | "not_coming"

export const RELATION_LABELS: Record<RelationSide, string> = {
  mama_pakkhu: "Mama Pakkhu (Maternal)",
  kaka_pakkhu: "Kaka Pakkhu (Paternal)",
  friend: "Friend",
  colleague: "Colleague",
  other: "Other",
}

export interface Guest {
  id: string
  event_id: string
  name: string
  phone: string
  village: string
  relation_side: RelationSide
  rsvp_status: RsvpStatus
  rsvp_at?: string
  invite_sent: boolean
  invite_sent_at?: string
  created_at: string
}

export interface RsvpSummary {
  total: number
  coming: number
  not_coming: number
  pending: number
}

export type PaymentMode = "upi" | "cash" | "gift"

export interface Entry {
  id: string
  event_id: string
  activity_id?: string
  guest_id?: string
  name: string
  village: string
  phone?: string
  amount: number
  mode: PaymentMode
  utr_number?: string
  razorpay_payment_id?: string
  is_unknown_guest: boolean
  gift_item?: string
  notes?: string
  confirmation_sent: boolean
  created_at: string
  logged_by: string
}

export interface EntrySummary {
  total: number
  total_upi: number
  total_cash: number
  total_gift: number
  count: number
  count_upi: number
  count_cash: number
  count_gift: number
}
