export type ActivityType =
  | "wedding"
  | "mehandi"
  | "garba"
  | "haldi"
  | "reception"
  | "puja"
  | "sangeet"
  | "engagement"
  | "tilak"
  | "griha_pravesh"
  | "naamkaran"
  | "custom"

export type ActivityStatus = "upcoming" | "active" | "completed"

export interface Activity {
  id: string
  event_id: string
  name: string
  type: ActivityType
  custom_type_name?: string
  date: string
  time?: string
  description?: string
  status: ActivityStatus
  guest_ids: string[]
  guest_count: number
  entry_count: number
  entry_total: number
  created_at: string
  updated_at: string
}

export interface ActivityDetail extends Activity {
  guests: {
    id: string
    name: string
    phone: string
    village: string
    relation_side: string
    rsvp_status: string
  }[]
  entry_summary: {
    total_amount: number
    entry_count: number
    upi_amount: number
    cash_amount: number
  }
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  wedding: "Wedding (Vivah)",
  mehandi: "Mehndi Ceremony",
  garba: "Garba Night",
  haldi: "Haldi Ceremony",
  reception: "Reception",
  puja: "Puja",
  sangeet: "Sangeet",
  engagement: "Engagement",
  tilak: "Tilak",
  griha_pravesh: "Griha Pravesh",
  naamkaran: "Naamkaran",
  custom: "Custom",
}

export const ACTIVITY_STATUS_COLORS: Record<ActivityStatus, string> = {
  upcoming: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
}
