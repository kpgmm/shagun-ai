"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, WifiOff } from "lucide-react"

import { EntryForm } from "@/components/entry/entry-form"
import { api } from "@/lib/api"
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
    <div className="min-h-screen bg-background">
      {/* Offline banner */}
      {!isOnline && (
        <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-white text-sm">
          <WifiOff className="h-4 w-4" />
          No internet connection — entries will not be saved
        </div>
      )}

      <div className="mx-auto max-w-lg px-4 py-4">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href={`/events/${eventId}`}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Dashboard
          </Link>
          {event && (
            <p className="text-xs text-muted-foreground truncate max-w-[180px]">
              {event.name}
            </p>
          )}
        </div>

        <h1 className="text-xl font-bold mb-5">Record Shagun Entry</h1>

        <EntryForm eventId={eventId} />
      </div>
    </div>
  )
}
