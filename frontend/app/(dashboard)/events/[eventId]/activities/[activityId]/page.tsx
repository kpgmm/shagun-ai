"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, Download, Users, ClipboardList, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { LiveFeed } from "@/components/dashboard/live-feed"
import { EntryForm } from "@/components/entry/entry-form"
import { ActivityGuestSelector } from "@/components/activities/activity-guest-selector"
import { getActivityDetail, downloadActivityReport } from "@/lib/api"
import { formatIndianCurrency } from "@/lib/utils"
import { ACTIVITY_TYPE_LABELS, ACTIVITY_STATUS_COLORS } from "@/types/activity"
import type { ActivityDetail } from "@/types/activity"

type Tab = "entries" | "guests" | "report"

const STATUS_LABELS = {
  upcoming: "Upcoming",
  active: "Active",
  completed: "Completed",
} as const

export default function ActivityDetailPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const activityId = params.activityId as string
  const [activeTab, setActiveTab] = useState<Tab>("entries")
  const [guestSelectorOpen, setGuestSelectorOpen] = useState(false)

  const { data: activity, isLoading } = useQuery<ActivityDetail>({
    queryKey: ["activity", eventId, activityId],
    queryFn: () => getActivityDetail(eventId, activityId),
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!activity) return <p className="text-muted-foreground">Activity not found.</p>

  const typeName =
    activity.type === "custom"
      ? (activity.custom_type_name ?? "Custom")
      : (ACTIVITY_TYPE_LABELS[activity.type] ?? activity.type)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/events/${eventId}/activities`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ChevronLeft className="h-4 w-4" />
          All Activities
        </Link>
        <div className="flex flex-wrap items-start gap-3 justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{activity.name}</h1>
              <Badge
                variant="secondary"
                className={ACTIVITY_STATUS_COLORS[activity.status]}
              >
                {STATUS_LABELS[activity.status]}
              </Badge>
              <Badge variant="outline" className="text-xs">{typeName}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date(activity.date).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
              {activity.time ? ` · ${activity.time}` : ""}
            </p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {activity.guest_count} guests invited
          </span>
          <span className="flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4" />
            {activity.entry_count} entries
          </span>
          {activity.entry_total > 0 && (
            <span className="font-bold text-primary">
              {formatIndianCurrency(activity.entry_total)}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["entries", "guests", "report"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab: Entries */}
      {activeTab === "entries" && (
        <div className="space-y-6">
          <EntryForm eventId={eventId} activityId={activityId} />
          <LiveFeed eventId={eventId} activityId={activityId} />
        </div>
      )}

      {/* Tab: Guests */}
      {activeTab === "guests" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {activity.guest_count} guests assigned to this activity
            </p>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setGuestSelectorOpen(true)}>
              <Users className="h-4 w-4" />
              Manage Guests
            </Button>
          </div>

          {activity.guests.length === 0 ? (
            <div className="rounded-xl border border-dashed py-12 text-center">
              <p className="text-sm text-muted-foreground">No guests assigned yet.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setGuestSelectorOpen(true)}
              >
                Add Guests
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              {activity.guests.map((guest, idx) => (
                <div
                  key={guest.id}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    idx !== activity.guests.length - 1 ? "border-b" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{guest.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {guest.village}
                      {guest.phone ? ` · ${guest.phone}` : ""}
                    </p>
                  </div>
                  {guest.rsvp_status === "coming" && (
                    <span className="text-xs text-green-600">Coming</span>
                  )}
                  {guest.rsvp_status === "not_coming" && (
                    <span className="text-xs text-red-500">Not Coming</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <ActivityGuestSelector
            eventId={eventId}
            activityId={activityId}
            currentGuestIds={activity.guest_ids}
            open={guestSelectorOpen}
            onClose={() => setGuestSelectorOpen(false)}
          />
        </div>
      )}

      {/* Tab: Report */}
      {activeTab === "report" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5 text-primary" />
                Activity Report
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-y-2">
                <span className="text-muted-foreground">Activity</span>
                <span className="font-medium">{activity.name}</span>
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{typeName}</span>
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">
                  {new Date(activity.date).toLocaleDateString("en-IN", {
                    day: "2-digit", month: "long", year: "numeric",
                  })}
                </span>
                <span className="text-muted-foreground">Entries</span>
                <span className="font-medium">{activity.entry_count}</span>
                <span className="text-muted-foreground">Total Collected</span>
                <span className="font-bold text-primary">
                  {formatIndianCurrency(activity.entry_total)}
                </span>
              </div>
              {activity.entry_summary && (
                <>
                  <div className="flex justify-between pt-1 border-t">
                    <span className="text-muted-foreground">UPI</span>
                    <span className="font-medium">
                      {formatIndianCurrency(activity.entry_summary.upi_amount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cash</span>
                    <span className="font-medium">
                      {formatIndianCurrency(activity.entry_summary.cash_amount)}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Button
            className="gap-2"
            onClick={() => downloadActivityReport(eventId, activityId)}
          >
            <Download className="h-4 w-4" />
            Download Activity Report (PDF)
          </Button>
        </div>
      )}
    </div>
  )
}
