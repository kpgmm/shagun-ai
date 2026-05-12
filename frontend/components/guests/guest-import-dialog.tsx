"use client"

import { useState, useEffect, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Users, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { api, ApiError, getEvents, importGuests } from "@/lib/api"
import { RELATION_LABELS } from "@/types"
import type { Event, Guest } from "@/types"

interface Props {
  targetEventId: string
  open: boolean
  onClose: () => void
  onImported?: (count: number) => void
  skipLabel?: string
}

export function GuestImportDialog({
  targetEventId,
  open,
  onClose,
  onImported,
  skipLabel = "Cancel",
}: Props) {
  const queryClient = useQueryClient()
  const [selectedEventId, setSelectedEventId] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [importing, setImporting] = useState(false)

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["events-list"],
    queryFn: getEvents,
    enabled: open,
  })

  const sourceEvents = events.filter((e) => e.id !== targetEventId)

  const { data: guestsData, isLoading: loadingGuests } = useQuery<Guest[]>({
    queryKey: ["guests-for-import", selectedEventId],
    queryFn: () => api.get<Guest[]>(`/api/events/${selectedEventId}/guests`),
    enabled: !!selectedEventId,
  })
  const guests = guestsData ?? []

  // Select all by default when the guest list first loads for a chosen event
  useEffect(() => {
    if (guestsData) {
      setSelected(new Set(guestsData.map((g) => g.id)))
    }
  }, [guestsData])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return q.length < 1
      ? guests
      : guests.filter(
          (g) =>
            g.name.toLowerCase().includes(q) ||
            g.village.toLowerCase().includes(q) ||
            g.phone.includes(q),
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

  async function handleImport() {
    if (!selectedEventId || selected.size === 0) return
    setImporting(true)
    try {
      const result = await importGuests(targetEventId, selectedEventId, Array.from(selected))
      const msg =
        result.skipped > 0
          ? `Imported ${result.imported} guests (${result.skipped} skipped as duplicates)`
          : `Imported ${result.imported} guests`
      toast.success(msg)
      await queryClient.invalidateQueries({ queryKey: ["guests", targetEventId] })
      onImported?.(result.imported)
      handleClose()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to import guests")
    } finally {
      setImporting(false)
    }
  }

  function handleClose() {
    setSelectedEventId("")
    setSelected(new Set())
    setSearch("")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Import Guests from Another Event
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 min-h-0">
          {/* Event picker */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Select the event to copy guests from:
            </p>
            {sourceEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No other events found.</p>
            ) : (
              <Select
                value={selectedEventId}
                onValueChange={(v) => {
                  setSelectedEventId(v)
                  setSearch("")
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose an event…" />
                </SelectTrigger>
                <SelectContent>
                  {sourceEvents.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} · {e.host_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Guest list */}
          {selectedEventId && (
            <div className="flex-1 overflow-hidden flex flex-col gap-2 min-h-0">
              {loadingGuests ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-11 w-full rounded-lg" />
                  ))}
                </div>
              ) : guests.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">This event has no guests.</p>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, village, or phone…"
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
                              {g.village} · {g.phone} ·{" "}
                              {RELATION_LABELS[g.relation_side] ?? g.relation_side}
                            </p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2 border-t mt-2">
          <Button
            onClick={handleImport}
            disabled={importing || selected.size === 0 || !selectedEventId}
            className="flex-1"
          >
            {importing
              ? "Importing…"
              : selected.size > 0
              ? `Import ${selected.size} Guests`
              : "Import Guests"}
          </Button>
          <Button variant="outline" onClick={handleClose}>
            {skipLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
