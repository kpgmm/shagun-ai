import Link from "next/link"
import { Plus } from "lucide-react"
import { cookies } from "next/headers"

import { Button } from "@/components/ui/button"
import { EventCardList } from "@/components/events/event-card-list"

async function getEvents() {
  const cookieStore = await cookies()
  const token = cookieStore.get("access_token")
  if (!token) return []

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/events`,
      {
        headers: { Cookie: `access_token=${token.value}` },
        cache: "no-store",
      },
    )
    const json = await res.json()
    return json.success ? json.data : []
  } catch {
    return []
  }
}

export default async function EventsPage() {
  const events = await getEvents()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Events</h1>
          <p className="text-sm text-muted-foreground">Manage your shagun events</p>
        </div>
        <Link href="/events/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Event
          </Button>
        </Link>
      </div>

      <EventCardList initialEvents={events} />
    </div>
  )
}
