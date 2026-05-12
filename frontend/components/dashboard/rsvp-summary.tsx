"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { RsvpSummary } from "@/types"

export function RsvpSummaryCard({ eventId }: { eventId: string }) {
  const { data } = useQuery<RsvpSummary>({
    queryKey: ["rsvp-summary", eventId],
    queryFn: () => api.get<RsvpSummary>(`/api/events/${eventId}/guests/rsvp-summary`),
  })

  if (!data) return null

  return (
    <div className="rounded-xl border p-4 bg-white">
      <h3 className="text-sm font-semibold mb-3">RSVP Summary</h3>
      <div className="space-y-2 text-sm">
        {[
          { label: "Total Invited", value: data.total, symbol: "" },
          { label: "Coming", value: data.coming, symbol: "✅" },
          { label: "Not Coming", value: data.not_coming, symbol: "❌" },
          { label: "No Response", value: data.pending, symbol: "⏳" },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="text-muted-foreground">
              {row.symbol} {row.label}
            </span>
            <span className="font-semibold tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
