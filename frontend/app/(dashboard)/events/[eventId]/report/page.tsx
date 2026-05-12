"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, Download, FileText, Send } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { api, getActivities, downloadEventReport, downloadActivityReport } from "@/lib/api"
import { formatIndianCurrency, formatISTDate } from "@/lib/utils"
import type { EntrySummary, Event, RsvpSummary } from "@/types"
import type { Activity } from "@/types/activity"
import { ACTIVITY_TYPE_LABELS } from "@/types/activity"

export default function ReportPage() {
  const params = useParams()
  const eventId = params.eventId as string

  const { data: event, isLoading: eventLoading } = useQuery<Event>({
    queryKey: ["event", eventId],
    queryFn: () => api.get<Event>(`/api/events/${eventId}`),
  })

  const { data: summary } = useQuery<EntrySummary>({
    queryKey: ["entries-summary", eventId],
    queryFn: () => api.get<EntrySummary>(`/api/events/${eventId}/entries/summary`),
  })

  const { data: rsvp } = useQuery<RsvpSummary>({
    queryKey: ["rsvp-summary", eventId],
    queryFn: () => api.get<RsvpSummary>(`/api/events/${eventId}/guests/rsvp-summary`),
  })

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ["activities", eventId],
    queryFn: () => getActivities(eventId),
    staleTime: 30_000,
  })

  if (eventLoading) return <Skeleton className="h-64 w-full rounded-xl" />
  if (!event) return <p>Event not found</p>

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href={`/events/${eventId}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <h1 className="text-2xl font-bold">Event Report</h1>
        <p className="text-sm text-muted-foreground">
          Download a formatted PDF summary of this event
        </p>
      </div>

      {/* Event info card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {event.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-y-2">
            <span className="text-muted-foreground">Date</span>
            <span className="font-medium">{formatISTDate(event.event_date)}</span>
            <span className="text-muted-foreground">Host</span>
            <span className="font-medium">{event.host_name}</span>
            <span className="text-muted-foreground">Village</span>
            <span className="font-medium">{event.host_village}</span>
            <span className="text-muted-foreground">Status</span>
            <span className="font-medium capitalize">{event.status}</span>
          </div>
        </CardContent>
      </Card>

      {/* Financial summary */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Financial Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              { label: "Total Collected", value: formatIndianCurrency(summary.total), bold: true },
              { label: "  UPI", value: formatIndianCurrency(summary.total_upi), bold: false },
              { label: "  Cash", value: formatIndianCurrency(summary.total_cash), bold: false },
              { label: "Total Entries", value: summary.count.toString(), bold: false },
            ].map((row) => (
              <div key={row.label} className="flex justify-between">
                <span className="text-muted-foreground">{row.label}</span>
                <span className={row.bold ? "font-bold text-primary text-base" : "font-medium"}>
                  {row.value}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* RSVP summary */}
      {rsvp && rsvp.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Guest Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              { label: "Total Invited", value: rsvp.total },
              { label: "Coming ✅", value: rsvp.coming },
              { label: "Not Coming ❌", value: rsvp.not_coming },
              { label: "No Response ⏳", value: rsvp.pending },
            ].map((row) => (
              <div key={row.label} className="flex justify-between">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-medium">{row.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Activity Reports */}
      {activities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activities.map((activity) => {
              const typeName =
                activity.type === "custom"
                  ? (activity.custom_type_name ?? "Custom")
                  : (ACTIVITY_TYPE_LABELS[activity.type] ?? activity.type)
              return (
                <div
                  key={activity.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{activity.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {typeName} · {activity.entry_count} entries · {formatIndianCurrency(activity.entry_total)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 shrink-0"
                    onClick={() => downloadActivityReport(eventId, activity.id)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    PDF
                  </Button>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Download actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => downloadEventReport(eventId)} className="gap-2">
          <Download className="h-4 w-4" />
          Download PDF Report
        </Button>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => toast.info("WhatsApp delivery requires Twilio configuration")}
        >
          <Send className="h-4 w-4" />
          Send to WhatsApp
        </Button>
      </div>
    </div>
  )
}
