"use client"

import { useQuery } from "@tanstack/react-query"
import { IndianRupee, Users, Wallet } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { formatIndianCurrency } from "@/lib/utils"
import type { EntrySummary } from "@/types"

export function SummaryCards({ eventId }: { eventId: string }) {
  const { data, isLoading } = useQuery<EntrySummary>({
    queryKey: ["entries-summary", eventId],
    queryFn: () => api.get<EntrySummary>(`/api/events/${eventId}/entries/summary`),
    refetchInterval: 10000, // refetch every 10s as backup
  })

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((n) => <Skeleton key={n} className="h-28 rounded-xl" />)}
      </div>
    )
  }

  const cards = [
    {
      label: "Total Collected",
      value: formatIndianCurrency(data.total),
      sub: `${data.count} entries`,
      icon: IndianRupee,
      color: "text-primary",
      bg: "bg-orange-50",
    },
    {
      label: "Total Guests",
      value: data.count.toString(),
      sub: [
        `${data.count_upi} UPI`,
        `${data.count_cash} Cash`,
        data.count_gift > 0 ? `${data.count_gift} Gift` : "",
      ].filter(Boolean).join(" · "),
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Cash / UPI Split",
      value: formatIndianCurrency(data.total_cash),
      sub: `UPI: ${formatIndianCurrency(data.total_upi)}`,
      icon: Wallet,
      color: "text-green-600",
      bg: "bg-green-50",
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.label} className="overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className={`rounded-lg p-2.5 ${card.bg}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
