"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, WifiOff } from "lucide-react"

import { EntryForm } from "@/components/entry/entry-form"
import { LiveFeed } from "@/components/dashboard/live-feed"
import { api } from "@/lib/api"
import { formatISTDate } from "@/lib/utils"
import type { Event } from "@/types"

export default function EntryPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const [isOnline, setIsOnline] = useState(true)

  const { data: event } = useQuery<Event>({
    queryKey: ["event", eventId],
    queryFn: () => api.get<Event>(`/api/events/${eventId}`),
  })

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    setIsOnline(navigator.onLine)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Offline banner */}
      {!isOnline && (
        <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2.5 text-white text-sm rounded-lg">
          <WifiOff className="h-4 w-4" />
          No internet connection — entries will not be saved
        </div>
      )}

      {/* Header */}
      <div>
        <Link
          href={`/events/${eventId}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ChevronLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <h1 className="text-2xl font-bold">Record Shagun Entry</h1>
        {event && (
          <p className="text-sm text-muted-foreground mt-1">
            {event.name} · {formatISTDate(event.event_date)} · {event.host_village}
          </p>
        )}
      </div>

      {/* Two-column layout: form (sticky) + live feed */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6 items-start">
        <div className="rounded-xl border bg-card p-5 lg:sticky lg:top-4">
          <p className="text-base font-semibold mb-4">Record Entry</p>
          <EntryForm eventId={eventId} />
        </div>
        <LiveFeed eventId={eventId} />
      </div>
    </div>
  )
}
