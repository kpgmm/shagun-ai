"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Search, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, getActivities } from "@/lib/api"
import { formatIndianCurrency, timeAgo } from "@/lib/utils"
import { getSocket, joinEventRoom, leaveEventRoom } from "@/lib/socket"
import { EntryRowActions } from "./entry-row-actions"
import type { Activity } from "@/types/activity"
import type { Entry } from "@/types"

const DEFAULT_ACTIVITY_LABEL = "Wedding (Vivah)"

export function LiveFeed({ eventId, activityId }: { eventId: string; activityId?: string }) {
  const queryClient = useQueryClient()
  const [connected, setConnected] = useState(false)

  // ── Filter state ─────────────────────────────────────────────────────────
  const [search, setSearch] = useState("")
  const [modeFilter, setModeFilter] = useState<"all" | "cash" | "upi" | "gift">("all")
  const [activityFilter, setActivityFilter] = useState<string>("all")
  const [minAmount, setMinAmount] = useState("")
  const [maxAmount, setMaxAmount] = useState("")

  const { data: allEntries = [], isLoading } = useQuery<Entry[]>({
    queryKey: ["entries", eventId],
    queryFn: () => api.get<Entry[]>(`/api/events/${eventId}/entries`),
  })

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ["activities", eventId],
    queryFn: () => getActivities(eventId),
    staleTime: 30_000,
  })

  const activityNameMap = useMemo(
    () => new Map(activities.map((a) => [a.id, a.name])),
    [activities],
  )

  // Base entries: scoped by activityId prop (activity detail page)
  const scopedEntries = useMemo(
    () => (activityId ? allEntries.filter((e) => e.activity_id === activityId) : allEntries),
    [allEntries, activityId],
  )

  // Apply all user-driven filters
  const filteredEntries = useMemo(() => {
    let result = scopedEntries

    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.village.toLowerCase().includes(q),
      )
    }

    if (modeFilter !== "all") {
      result = result.filter((e) => e.mode === modeFilter)
    }

    if (!activityId && activityFilter !== "all") {
      result = result.filter((e) => e.activity_id === activityFilter)
    }

    const min = parseFloat(minAmount)
    const max = parseFloat(maxAmount)
    if (!isNaN(min) && min > 0) result = result.filter((e) => e.amount >= min)
    if (!isNaN(max) && max > 0) result = result.filter((e) => e.amount <= max)

    return result
  }, [scopedEntries, search, modeFilter, activityFilter, activityId, minAmount, maxAmount])

  const isFiltered =
    search.trim() !== "" ||
    modeFilter !== "all" ||
    (!activityId && activityFilter !== "all") ||
    minAmount !== "" ||
    maxAmount !== ""

  function clearFilters() {
    setSearch("")
    setModeFilter("all")
    setActivityFilter("all")
    setMinAmount("")
    setMaxAmount("")
  }

  useEffect(() => {
    const socket = getSocket()

    socket.on("connect", () => setConnected(true))
    socket.on("disconnect", () => setConnected(false))

    socket.on("new_entry", (entry: Entry) => {
      queryClient.setQueryData<Entry[]>(["entries", eventId], (old = []) => [entry, ...old])
      queryClient.invalidateQueries({ queryKey: ["entries-summary", eventId] })
    })

    socket.on("entry_updated", (updated: Entry) => {
      queryClient.setQueryData<Entry[]>(["entries", eventId], (old = []) =>
        old.map((e) => (e.id === updated.id ? updated : e)),
      )
      queryClient.invalidateQueries({ queryKey: ["entries-summary", eventId] })
    })

    socket.on("entry_deleted", ({ id }: { id: string }) => {
      queryClient.setQueryData<Entry[]>(["entries", eventId], (old = []) =>
        old.filter((e) => e.id !== id),
      )
      queryClient.invalidateQueries({ queryKey: ["entries-summary", eventId] })
    })

    joinEventRoom(eventId)

    return () => {
      leaveEventRoom(eventId)
      socket.off("new_entry")
      socket.off("entry_updated")
      socket.off("entry_deleted")
      socket.off("connect")
      socket.off("disconnect")
    }
  }, [eventId, queryClient])

  if (isLoading) return <Skeleton className="h-48 w-full rounded-xl" />

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">Live Entry Feed</h2>
        <span
          className={`flex h-2 w-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-gray-400"}`}
        />
        <span className="text-xs text-muted-foreground">{connected ? "Live" : "Connecting..."}</span>
        {isFiltered && (
          <span className="ml-auto text-xs text-muted-foreground">
            {filteredEntries.length} of {scopedEntries.length} entries
          </span>
        )}
      </div>

      {/* Filter bar */}
      <div className="space-y-2">
        {/* Row 1: search + mode toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name or village..."
              className="pl-8 h-8 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Mode toggle */}
          <div className="flex rounded-lg border overflow-hidden text-xs font-medium">
            {(["all", "cash", "upi", "gift"] as const).map((m) => (
              <button
                key={m}
                className={`px-3 py-1.5 transition-colors ${
                  modeFilter === m
                    ? "bg-primary text-white"
                    : "hover:bg-muted text-muted-foreground"
                }`}
                onClick={() => setModeFilter(m)}
              >
                {m === "all" ? "All" : m === "cash" ? "💵 Cash" : m === "upi" ? "📱 UPI" : "🎁 Gift"}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: activity filter + amount range + clear */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Activity filter — only on the main event dashboard */}
          {!activityId && activities.length > 0 && (
            <Select value={activityFilter} onValueChange={setActivityFilter}>
              <SelectTrigger className="h-8 text-xs w-[180px]">
                <SelectValue placeholder="All Activities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activities</SelectItem>
                {activities.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground shrink-0">₹ Min</span>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="0"
              className="h-8 text-xs w-20"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground shrink-0">Max</span>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="∞"
              className="h-8 text-xs w-20"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
            />
          </div>

          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1 text-muted-foreground"
              onClick={clearFilters}
            >
              <X className="h-3 w-3" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      {scopedEntries.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center">
          <p className="text-muted-foreground text-sm">No entries yet — waiting for guests...</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="rounded-xl border border-dashed py-10 text-center">
          <p className="text-muted-foreground text-sm">No entries match the current filters.</p>
          <button className="mt-2 text-xs text-primary hover:underline" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Village</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Mode</TableHead>
                {!activityId && <TableHead className="hidden lg:table-cell">Activity</TableHead>}
                <TableHead className="hidden md:table-cell">Time</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => (
                <TableRow
                  key={entry.id}
                  className={entry.is_unknown_guest ? "bg-amber-50 hover:bg-amber-100" : ""}
                >
                  <TableCell className="font-medium">
                    {entry.is_unknown_guest && (
                      <AlertTriangle className="inline h-3.5 w-3.5 text-amber-500 mr-1 mb-0.5" />
                    )}
                    {entry.name}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {entry.village || "—"}
                  </TableCell>
                  <TableCell className="font-semibold text-primary">
                    {entry.mode === "gift" ? (
                      <span className="text-purple-700 font-medium text-sm">
                        {entry.amount > 0 && (
                          <span className="text-primary font-bold mr-1">
                            {formatIndianCurrency(entry.amount)} ·
                          </span>
                        )}
                        {entry.gift_item || "Gift"}
                      </span>
                    ) : formatIndianCurrency(entry.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${
                        entry.mode === "upi"
                          ? "bg-blue-50 text-blue-700"
                          : entry.mode === "gift"
                          ? "bg-purple-50 text-purple-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {entry.mode.toUpperCase()}
                    </Badge>
                  </TableCell>
                  {!activityId && (
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {entry.activity_id
                        ? (activityNameMap.get(entry.activity_id) ?? "—")
                        : DEFAULT_ACTIVITY_LABEL}
                    </TableCell>
                  )}
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {timeAgo(entry.created_at)}
                  </TableCell>
                  <TableCell>
                    <EntryRowActions entry={entry} eventId={eventId} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
