"use client"

import { useState } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Pencil, Trash2, Users, ClipboardList, Calendar, Clock, ArrowRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { updateActivityStatus, deleteActivity, ApiError } from "@/lib/api"
import { formatIndianCurrency } from "@/lib/utils"
import { ACTIVITY_TYPE_LABELS, ACTIVITY_STATUS_COLORS } from "@/types/activity"
import type { Activity, ActivityStatus } from "@/types/activity"
import { ActivityForm } from "./activity-form"

interface Props {
  activity: Activity
  eventId: string
}

const STATUS_LABELS: Record<ActivityStatus, string> = {
  upcoming: "Upcoming",
  active: "Active",
  completed: "Completed",
}

const NEXT_STATUS: Partial<Record<ActivityStatus, { status: ActivityStatus; label: string }>> = {
  upcoming: { status: "active", label: "Activate" },
  active: { status: "completed", label: "Mark Complete" },
}

export function ActivityCard({ activity, eventId }: Props) {
  const queryClient = useQueryClient()
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  const typeName =
    activity.type === "custom"
      ? (activity.custom_type_name ?? "Custom")
      : (ACTIVITY_TYPE_LABELS[activity.type] ?? activity.type)

  async function handleStatusChange(nextStatus: ActivityStatus) {
    setUpdatingStatus(true)
    try {
      await updateActivityStatus(eventId, activity.id, nextStatus)
      await queryClient.invalidateQueries({ queryKey: ["activities", eventId] })
      toast.success(`Activity marked as ${nextStatus}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update status")
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${activity.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await deleteActivity(eventId, activity.id)
      await queryClient.invalidateQueries({ queryKey: ["activities", eventId] })
      toast.success("Activity deleted")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete activity")
    } finally {
      setDeleting(false)
    }
  }

  const next = NEXT_STATUS[activity.status]

  return (
    <>
      <Card className="group hover:shadow-md hover:border-primary/40 transition-all">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/events/${eventId}/activities/${activity.id}`}
              className="flex-1 min-w-0"
            >
              <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
                {activity.name}
              </CardTitle>
            </Link>
            <Badge
              variant="secondary"
              className={`shrink-0 text-xs ${ACTIVITY_STATUS_COLORS[activity.status]}`}
            >
              {STATUS_LABELS[activity.status]}
            </Badge>
          </div>
          <Badge variant="outline" className="w-fit text-xs mt-1">
            {typeName}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>{new Date(activity.date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</span>
            </div>
            {activity.time && (
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>{activity.time}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>{activity.guest_count} guests</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ClipboardList className="h-3.5 w-3.5" />
              <span>{activity.entry_count} entries</span>
            </div>
          </div>

          {activity.entry_total > 0 && (
            <p className="text-base font-bold text-primary">
              {formatIndianCurrency(activity.entry_total)}
            </p>
          )}

          {/* Status + edit/delete */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {next && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => handleStatusChange(next.status)}
                disabled={updatingStatus}
              >
                {next.label}
              </Button>
            )}
            <div className="ml-auto flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowEdit(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Open button — always visible, full width */}
          <Link
            href={`/events/${eventId}/activities/${activity.id}`}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-primary hover:text-white group-hover:bg-primary group-hover:text-white"
          >
            Open
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardContent>
      </Card>

      <Dialog open={showEdit} onOpenChange={(o) => !o && setShowEdit(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Activity</DialogTitle>
          </DialogHeader>
          <ActivityForm
            eventId={eventId}
            activity={activity}
            onSuccess={() => setShowEdit(false)}
            onCancel={() => setShowEdit(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
