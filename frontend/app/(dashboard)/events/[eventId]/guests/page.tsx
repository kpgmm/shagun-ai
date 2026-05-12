"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ChevronLeft, Plus, Upload, Send, Users, ArrowDownToLine } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GuestsTable } from "@/components/guests/guests-table"
import { GuestForm } from "@/components/guests/guest-form"
import { ExcelUpload } from "@/components/guests/excel-upload"
import { GuestImportDialog } from "@/components/guests/guest-import-dialog"
import { api, ApiError } from "@/lib/api"
import type { RsvpSummary } from "@/types"

export default function GuestsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const [showAddGuest, setShowAddGuest] = useState(false)
  const [showExcelUpload, setShowExcelUpload] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [sendingInvites, setSendingInvites] = useState(false)

  const { data: rsvp } = useQuery<RsvpSummary>({
    queryKey: ["rsvp-summary", eventId],
    queryFn: () => api.get<RsvpSummary>(`/api/events/${eventId}/guests/rsvp-summary`),
  })

  async function handleSendInvites(onlyUninvited: boolean) {
    setSendingInvites(true)
    try {
      const result = await api.post<{ queued: number; message: string }>(
        `/api/events/${eventId}/guests/send-invites?only_uninvited=${onlyUninvited}`,
        {},
      )
      toast.success(result.message)
      await queryClient.invalidateQueries({ queryKey: ["guests", eventId] })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to send invites")
    } finally {
      setSendingInvites(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/events/${eventId}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Guest List</h1>
            <p className="text-sm text-muted-foreground">Manage invitees for this event</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)} className="gap-2">
              <ArrowDownToLine className="h-4 w-4" />
              Import from Event
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowExcelUpload(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Bulk Upload
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSendInvites(true)}
              disabled={sendingInvites}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Send Invites
            </Button>
            <Button size="sm" onClick={() => setShowAddGuest(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Guest
            </Button>
          </div>
        </div>
      </div>

      {/* RSVP Summary */}
      {rsvp && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total Invited", value: rsvp.total, color: "text-foreground" },
            { label: "Coming ✅", value: rsvp.coming, color: "text-green-600" },
            { label: "Not Coming ❌", value: rsvp.not_coming, color: "text-red-600" },
            { label: "No Response ⏳", value: rsvp.pending, color: "text-amber-600" },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="py-4 text-center">
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <GuestsTable eventId={eventId} />

      <GuestForm
        eventId={eventId}
        open={showAddGuest}
        onClose={() => setShowAddGuest(false)}
      />

      <ExcelUpload
        eventId={eventId}
        open={showExcelUpload}
        onClose={() => setShowExcelUpload(false)}
      />

      <GuestImportDialog
        targetEventId={eventId}
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => queryClient.invalidateQueries({ queryKey: ["guests", eventId] })}
      />
    </div>
  )
}
