"use client"

import { useState, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { updateActivity, api, ApiError } from "@/lib/api"
import { RELATION_LABELS } from "@/types"
import type { Guest } from "@/types"

interface Props {
  eventId: string
  activityId: string
  currentGuestIds: string[]
  open: boolean
  onClose: () => void
}

export function ActivityGuestSelector({ eventId, activityId, currentGuestIds, open, onClose }: Props) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set(currentGuestIds))
  const [saving, setSaving] = useState(false)

  const { data: guests = [] } = useQuery<Guest[]>({
    queryKey: ["guests", eventId],
    queryFn: () => api.get<Guest[]>(`/api/events/${eventId}/guests`),
    enabled: open,
  })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return q.length < 1
      ? guests
      : guests.filter(
          (g) =>
            g.name.toLowerCase().includes(q) ||
            g.village.toLowerCase().includes(q),
        )
  }, [guests, search])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(filtered.map((g) => g.id)))
  }

  function deselectAll() {
    setSelected((prev) => {
      const next = new Set(prev)
      filtered.forEach((g) => next.delete(g.id))
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updateActivity(eventId, activityId, { guest_ids: Array.from(selected) })
      await queryClient.invalidateQueries({ queryKey: ["activities", eventId] })
      await queryClient.invalidateQueries({ queryKey: ["activity", eventId, activityId] })
      toast.success("Guest list updated")
      onClose()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update guests")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setSearch("")
          setSelected(new Set(currentGuestIds))
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Activity Guests</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or village..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{selected.size} of {guests.length} selected</span>
          <div className="flex gap-2">
            <button className="text-primary hover:underline text-xs" onClick={selectAll}>
              Select All
            </button>
            <span>·</span>
            <button className="text-primary hover:underline text-xs" onClick={deselectAll}>
              Deselect All
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No guests found</p>
          ) : (
            filtered.map((g) => (
              <label
                key={g.id}
                className="flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-muted transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selected.has(g.id)}
                  onChange={() => toggle(g.id)}
                  className="h-4 w-4 rounded accent-primary"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{g.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.village} · {RELATION_LABELS[g.relation_side as keyof typeof RELATION_LABELS] ?? g.relation_side}
                  </p>
                </div>
                {g.rsvp_status === "coming" && (
                  <span className="text-xs text-green-600">✅</span>
                )}
              </label>
            ))
          )}
        </div>

        <div className="flex gap-3 pt-2 border-t">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? "Saving..." : "Save Guest List"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
