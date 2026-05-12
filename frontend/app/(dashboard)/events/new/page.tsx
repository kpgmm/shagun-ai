"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { api, createActivity, ApiError } from "@/lib/api"
import { ActivityForm } from "@/components/activities/activity-form"
import { GuestImportDialog } from "@/components/guests/guest-import-dialog"
import { ACTIVITY_TYPE_LABELS } from "@/types/activity"
import type { Event } from "@/types"
import type { ActivityFormValues } from "@/components/activities/activity-form"

// ── Step 1 schema (matches existing EventForm exactly) ────────────────────────
const eventSchema = z.object({
  name: z.string().min(2, "Event name is required"),
  type: z.enum(["wedding", "naamkaran", "griha_pravesh", "puja", "other"]),
  event_date: z.string().min(1, "Event date is required"),
  host_name: z.string().min(2, "Host name is required"),
  host_village: z.string().min(2, "Village / city is required"),
  host_upi_id: z.string().min(3, "UPI ID is required"),
  host_whatsapp: z.string().regex(/^\d{10}$/, "Enter 10-digit WhatsApp number"),
})

type EventFormValues = z.infer<typeof eventSchema>

const EVENT_TYPES = [
  { value: "wedding", label: "Wedding (Vivah)" },
  { value: "naamkaran", label: "Naamkaran" },
  { value: "griha_pravesh", label: "Griha Pravesh" },
  { value: "puja", label: "Puja" },
  { value: "other", label: "Other" },
]

type ActivityDraft = ActivityFormValues & { _key: string }

export default function NewEventPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [eventData, setEventData] = useState<EventFormValues | null>(null)
  const [activities, setActivities] = useState<ActivityDraft[]>([])
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createdEventId, setCreatedEventId] = useState<string | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
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

  function handleStep1(values: EventFormValues) {
    setEventData(values)
    setStep(2)
  }

  function addActivityDraft(values: ActivityFormValues) {
    setActivities((prev) => [...prev, { ...values, _key: crypto.randomUUID() }])
    setShowActivityForm(false)
  }

  function removeActivity(key: string) {
    setActivities((prev) => prev.filter((a) => a._key !== key))
  }

  async function handleCreateEvent() {
    if (activities.length === 0) {
      toast.error("Add at least one activity before creating the event")
      return
    }
    if (!eventData) return

    setCreating(true)
    try {
      const event = await api.post<Event>("/api/events", eventData)

      for (const activity of activities) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _key, ...activityPayload } = activity
        await createActivity(event.id, { ...activityPayload, guest_ids: [] })
      }

      toast.success("Event created successfully!")
      setCreatedEventId(event.id)
      setShowImportDialog(true)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create event")
    } finally {
      setCreating(false)
    }
  }

  function handleImportClose() {
    setShowImportDialog(false)
    if (createdEventId) {
      router.push(`/events/${createdEventId}`)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Back link */}
      <Link
        href="/events"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Events
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Create New Event</h1>
        <p className="text-sm text-muted-foreground">Set up your event and add its activities</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3">
        {([1, 2] as const).map((s, idx) => (
          <div key={s} className="flex items-center gap-2">
            {idx > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <div className="flex items-center gap-2">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  step === s
                    ? "bg-primary text-white"
                    : step > s
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {step > s ? "✓" : s}
              </div>
              <span
                className={`text-sm ${
                  step === s ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                {s === 1 ? "Event Details" : "Add Activities"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Step 1: Event Details ─────────────────────────────────────────────── */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleStep1)} className="space-y-5">
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
                  <Button type="submit" className="gap-2">
                    Next: Add Activities
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Add Activities ────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Activities</CardTitle>
                <Button size="sm" onClick={() => setShowActivityForm(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Activity
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <div className="rounded-xl border border-dashed py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    No activities yet. Add at least one activity (e.g. Mehendi, Baraat, Reception).
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 gap-2"
                    onClick={() => setShowActivityForm(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Add Activity
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {activities.map((a) => (
                    <div
                      key={a._key}
                      className="flex items-center gap-3 rounded-lg border px-4 py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{a.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {ACTIVITY_TYPE_LABELS[a.type]} · {a.date}
                          {a.time ? ` · ${a.time}` : ""}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {a.type === "custom" ? a.custom_type_name : ACTIVITY_TYPE_LABELS[a.type]}
                      </Badge>
                      <button
                        onClick={() => removeActivity(a._key)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleCreateEvent}
              disabled={creating || activities.length === 0}
              className="gap-2"
            >
              {creating ? "Creating..." : "Create Event →"}
            </Button>
          </div>
        </div>
      )}

      {/* Add Activity dialog (draft mode) */}
      <Dialog open={showActivityForm} onOpenChange={(o) => !o && setShowActivityForm(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Activity</DialogTitle>
          </DialogHeader>
          <ActivityForm
            onDraftSubmit={addActivityDraft}
            onCancel={() => setShowActivityForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Optional guest import after event creation */}
      {createdEventId && (
        <GuestImportDialog
          targetEventId={createdEventId}
          open={showImportDialog}
          onClose={handleImportClose}
          onImported={() => {}}
          skipLabel="Skip"
        />
      )}
    </div>
  )
}
