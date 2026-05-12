"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ChevronLeft, Users, QrCode, FileSpreadsheet, ClipboardList, CalendarDays } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { SummaryCards } from "@/components/dashboard/summary-cards"
import { LiveFeed } from "@/components/dashboard/live-feed"
import { RsvpSummaryCard } from "@/components/dashboard/rsvp-summary"
import { api, ApiError, getActivities } from "@/lib/api"
import { formatISTDate } from "@/lib/utils"
import type { Event } from "@/types"
import type { Activity } from "@/types/activity"

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  completed: "Completed",
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
}

export default function EventDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const eventId = params.eventId as string
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const { data: event, isLoading } = useQuery<Event>({
    queryKey: ["event", eventId],
    queryFn: () => api.get<Event>(`/api/events/${eventId}`),
  })

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ["activities", eventId],
    queryFn: () => getActivities(eventId),
    staleTime: 30_000,
  })

  async function markCompleted() {
    if (!confirm("Mark this event as completed?")) return
    setUpdatingStatus(true)
    try {
      await api.patch(`/api/events/${eventId}/status`, { status: "completed" })
      await queryClient.invalidateQueries({ queryKey: ["event", eventId] })
      toast.success("Event marked as completed")
      router.push(`/events/${eventId}/report`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update status")
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function markActive() {
    setUpdatingStatus(true)
    try {
      await api.patch(`/api/events/${eventId}/status`, { status: "active" })
      await queryClient.invalidateQueries({ queryKey: ["event", eventId] })
      toast.success("Event is now active")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update status")
    } finally {
      setUpdatingStatus(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!event) return <p className="text-muted-foreground">Event not found.</p>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/events"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ChevronLeft className="h-4 w-4" />
          All Events
        </Link>
        <div className="flex flex-wrap items-start gap-3 justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{event.name}</h1>
              <Badge className={STATUS_COLORS[event.status]} variant="secondary">
                {STATUS_LABELS[event.status]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {formatISTDate(event.event_date)} · {event.host_village} · {event.host_name}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2">
            <Link href={`/events/${eventId}/entry`}>
              <Button size="sm" className="gap-2">
                <ClipboardList className="h-4 w-4" />
                Record Entry
              </Button>
            </Link>
            <Link href={`/events/${eventId}/activities`}>
              <Button size="sm" variant="outline" className="gap-2">
                <CalendarDays className="h-4 w-4" />
                Activities
              </Button>
            </Link>
            <Link href={`/events/${eventId}/guests`}>
              <Button size="sm" variant="outline" className="gap-2">
                <Users className="h-4 w-4" />
                Guests
              </Button>
            </Link>
            <Link href={`/events/${eventId}/report`}>
              <Button size="sm" variant="outline" className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Report
              </Button>
            </Link>
            {event.status === "draft" && (
              <Button size="sm" variant="outline" onClick={markActive} disabled={updatingStatus}>
                Activate Event
              </Button>
            )}
            {event.status === "active" && (
              <Button
                size="sm"
                variant="outline"
                onClick={markCompleted}
                disabled={updatingStatus}
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                Mark Completed
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* QR Code if available */}
      {event.razorpay_qr_image_url && (
        <div className="flex items-center gap-4 rounded-xl border bg-orange-50 p-4">
          <QrCode className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">UPI QR Code Ready</p>
            <p className="text-xs text-muted-foreground">Display at entrance for digital payments</p>
          </div>
          <a
            href={event.razorpay_qr_image_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm" variant="outline">View QR</Button>
          </a>
        </div>
      )}

      {/* Summary Cards */}
      <SummaryCards eventId={eventId} />

      {/* Activities summary */}
      {activities.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium">{activities.length} Activities</span>
            {(["upcoming", "active", "completed"] as const).map((status) => {
              const count = activities.filter((a) => a.status === status).length
              if (count === 0) return null
              return (
                <span key={status} className="text-muted-foreground">
                  {count} {status}
                </span>
              )
            })}
          </div>
          <Link href={`/events/${eventId}/activities`}>
            <Button size="sm" variant="outline" className="gap-1 text-xs">
              View Activities
            </Button>
          </Link>
        </div>
      )}

      {/* Main content area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LiveFeed eventId={eventId} />
        </div>
        <div>
          <RsvpSummaryCard eventId={eventId} />
        </div>
      </div>
    </div>
  )
}
