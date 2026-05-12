"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronLeft, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { ActivityCard } from "@/components/activities/activity-card"
import { ActivityForm } from "@/components/activities/activity-form"
import { api, getActivities } from "@/lib/api"
import type { Activity } from "@/types/activity"
import type { Event } from "@/types"

export default function ActivitiesPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()
  const [showAddDialog, setShowAddDialog] = useState(false)

  const { data: event } = useQuery<Event>({
    queryKey: ["event", eventId],
    queryFn: () => api.get<Event>(`/api/events/${eventId}`),
    staleTime: 30_000,
  })

  const { data: activities = [], isLoading } = useQuery<Activity[]>({
    queryKey: ["activities", eventId],
    queryFn: () => getActivities(eventId),
    staleTime: 30_000,
  })

  function handleActivityAdded() {
    setShowAddDialog(false)
    queryClient.invalidateQueries({ queryKey: ["activities", eventId] })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/events/${eventId}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ChevronLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">
              Activities{event ? ` — ${event.name}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage event activities and track entries per activity
            </p>
          </div>
          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Activity
          </Button>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <p className="text-muted-foreground">No activities yet. Add your first activity.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 gap-2"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="h-4 w-4" />
            Add Activity
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} eventId={eventId} />
          ))}
        </div>
      )}

      <Dialog open={showAddDialog} onOpenChange={(o) => !o && setShowAddDialog(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Activity</DialogTitle>
          </DialogHeader>
          <ActivityForm
            eventId={eventId}
            onSuccess={handleActivityAdded}
            onCancel={() => setShowAddDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
