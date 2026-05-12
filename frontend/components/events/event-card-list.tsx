"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Calendar, MapPin, Users, ArrowRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { formatISTDate } from "@/lib/utils"
import type { Event } from "@/types"

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  wedding: "Wedding",
  naamkaran: "Naamkaran",
  griha_pravesh: "Griha Pravesh",
  puja: "Puja",
  other: "Other",
}

export function EventCardList({ initialEvents }: { initialEvents: Event[] }) {
  const { data: events = initialEvents, isLoading } = useQuery<Event[]>({
    queryKey: ["events"],
    queryFn: () => api.get<Event[]>("/api/events"),
    initialData: initialEvents,
  })

  if (isLoading && events.length === 0) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-44 rounded-xl" />
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
        <div className="text-5xl mb-4">🌸</div>
        <h3 className="text-lg font-medium">No events yet</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Create your first shagun event to get started
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <Link key={event.id} href={`/events/${event.id}`}>
          <Card className="group h-full transition-shadow hover:shadow-md cursor-pointer">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base line-clamp-2">{event.name}</CardTitle>
                <Badge
                  className={`shrink-0 text-xs capitalize ${STATUS_COLORS[event.status] ?? ""}`}
                  variant="secondary"
                >
                  {event.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {EVENT_TYPE_LABELS[event.type] ?? event.type}
              </p>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>{formatISTDate(event.event_date)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>{event.host_village}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span>{event.host_name}</span>
              </div>
              <div className="flex items-center justify-end mt-2">
                <ArrowRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
