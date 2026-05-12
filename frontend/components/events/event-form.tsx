"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, ApiError } from "@/lib/api"
import type { Event } from "@/types"

const schema = z.object({
  name: z.string().min(2, "Event name is required"),
  type: z.enum(["wedding", "naamkaran", "griha_pravesh", "puja", "other"]),
  event_date: z.string().min(1, "Event date is required"),
  host_name: z.string().min(2, "Host name is required"),
  host_village: z.string().min(2, "Village / city is required"),
  host_upi_id: z.string().min(3, "UPI ID is required"),
  host_whatsapp: z.string().regex(/^\d{10}$/, "Enter 10-digit WhatsApp number"),
})

type FormValues = z.infer<typeof schema>

const EVENT_TYPES = [
  { value: "wedding", label: "Wedding (Vivah)" },
  { value: "naamkaran", label: "Naamkaran" },
  { value: "griha_pravesh", label: "Griha Pravesh" },
  { value: "puja", label: "Puja" },
  { value: "other", label: "Other" },
]

export function EventForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      type: "wedding",
      event_date: "",
      host_name: "",
      host_village: "",
      host_upi_id: "",
      host_whatsapp: "",
    },
  })

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      const event = await api.post<Event>("/api/events", values)
      toast.success("Event created successfully!")
      router.push(`/events/${event.id}`)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to create event"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Event Details</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Patel-Shah Vivah Mahotsav" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EVENT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="event_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="host_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Host Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Rameshbhai Patel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="host_village"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Village / City</FormLabel>
                    <FormControl>
                      <Input placeholder="Anand" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="host_upi_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Host UPI ID</FormLabel>
                    <FormControl>
                      <Input placeholder="ramesh@upi" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="host_whatsapp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="10-digit number"
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Event"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
