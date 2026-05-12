"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Pencil, Trash2, Send, Filter, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { GuestForm } from "@/components/guests/guest-form"
import { api, ApiError } from "@/lib/api"
import type { Guest, RsvpStatus } from "@/types"

const RSVP_BADGES: Record<RsvpStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-gray-100 text-gray-600" },
  coming: { label: "Coming ✅", className: "bg-green-100 text-green-700" },
  not_coming: { label: "Not Coming ❌", className: "bg-red-100 text-red-700" },
}

const RELATION_LABELS: Record<string, string> = {
  mama_pakkhu: "Mama Pakkhu",
  kaka_pakkhu: "Kaka Pakkhu",
  friend: "Friend",
  colleague: "Colleague",
  other: "Other",
}

export function GuestsTable({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient()
  const [editGuest, setEditGuest] = useState<Guest | null>(null)
  const [filterRelation, setFilterRelation] = useState<string>("all")
  const [filterRsvp, setFilterRsvp] = useState<string>("all")
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sendingSelected, setSendingSelected] = useState(false)

  const selectAllRef = useRef<HTMLInputElement>(null)

  const { data: guests = [], isLoading } = useQuery<Guest[]>({
    queryKey: ["guests", eventId],
    queryFn: () => api.get<Guest[]>(`/api/events/${eventId}/guests`),
  })

  const filtered = useMemo(
    () =>
      guests.filter((g) => {
        if (filterRelation !== "all" && g.relation_side !== filterRelation) return false
        if (filterRsvp !== "all" && g.rsvp_status !== filterRsvp) return false
        return true
      }),
    [guests, filterRelation, filterRsvp],
  )

  const selectedInFiltered = useMemo(
    () => filtered.filter((g) => selectedIds.has(g.id)),
    [filtered, selectedIds],
  )
  const allFilteredSelected = filtered.length > 0 && selectedInFiltered.length === filtered.length
  const someFilteredSelected = selectedInFiltered.length > 0 && !allFilteredSelected

  // Keep the "select all" checkbox indeterminate when partially selected
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someFilteredSelected
    }
  }, [someFilteredSelected])

  function toggleAll() {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        filtered.forEach((g) => next.delete(g.id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        filtered.forEach((g) => next.add(g.id))
        return next
      })
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function handleDelete(guest: Guest) {
    if (!confirm(`Delete ${guest.name}? This cannot be undone.`)) return
    try {
      await api.delete(`/api/events/${eventId}/guests/${guest.id}`)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(guest.id)
        return next
      })
      await queryClient.invalidateQueries({ queryKey: ["guests", eventId] })
      toast.success("Guest removed")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete")
    }
  }

  async function handleSendInvite(guest: Guest) {
    setSendingId(guest.id)
    try {
      await api.post(`/api/events/${eventId}/guests/${guest.id}/send-invite`, {})
      toast.success(`Invite queued for ${guest.name}`)
      await queryClient.invalidateQueries({ queryKey: ["guests", eventId] })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to send invite")
    } finally {
      setSendingId(null)
    }
  }

  async function handleSendSelected() {
    if (selectedIds.size === 0) return
    setSendingSelected(true)
    try {
      const result = await api.post<{ queued: number; message: string }>(
        `/api/events/${eventId}/guests/send-invites`,
        { guest_ids: Array.from(selectedIds) },
      )
      toast.success(result.message)
      await queryClient.invalidateQueries({ queryKey: ["guests", eventId] })
      clearSelection()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to send invites")
    } finally {
      setSendingSelected(false)
    }
  }

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterRelation} onValueChange={setFilterRelation}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Relations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Relations</SelectItem>
            {Object.entries(RELATION_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterRsvp} onValueChange={setFilterRsvp}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All RSVP" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All RSVP</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="coming">Coming</SelectItem>
            <SelectItem value="not_coming">Not Coming</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">
          {filtered.length} of {guests.length} guests
        </span>
      </div>

      {/* Selection action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium text-primary">
            {selectedIds.size} guest{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <Button
            size="sm"
            className="gap-2 h-8"
            onClick={handleSendSelected}
            disabled={sendingSelected}
          >
            <Send className="h-3.5 w-3.5" />
            {sendingSelected ? "Sending…" : `Send Invites (${selectedIds.size})`}
          </Button>
          <button
            onClick={clearSelection}
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <p className="text-muted-foreground">No guests found</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded accent-primary cursor-pointer"
                    title="Select all visible guests"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="hidden md:table-cell">Village</TableHead>
                <TableHead className="hidden md:table-cell">Relation</TableHead>
                <TableHead>Invite</TableHead>
                <TableHead>RSVP</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((g) => (
                <TableRow
                  key={g.id}
                  className={selectedIds.has(g.id) ? "bg-primary/5" : undefined}
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(g.id)}
                      onChange={() => toggleOne(g.id)}
                      className="h-4 w-4 rounded accent-primary cursor-pointer"
                    />
                  </TableCell>
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{g.phone}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{g.village}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {RELATION_LABELS[g.relation_side] ?? g.relation_side}
                  </TableCell>
                  <TableCell>
                    {g.invite_sent ? (
                      <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-xs">
                        Sent
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${RSVP_BADGES[g.rsvp_status]?.className}`}
                    >
                      {RSVP_BADGES[g.rsvp_status]?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-7 w-7 ${g.invite_sent ? "text-blue-500 hover:text-blue-600" : "text-muted-foreground hover:text-foreground"}`}
                        onClick={() => handleSendInvite(g)}
                        disabled={sendingId === g.id}
                        title={g.invite_sent ? "Re-send invite" : "Send invite"}
                      >
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setEditGuest(g)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(g)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editGuest && (
        <GuestForm
          eventId={eventId}
          guest={editGuest}
          open={true}
          onClose={() => setEditGuest(null)}
        />
      )}
    </div>
  )
}
