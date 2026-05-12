"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createActivity, updateActivity, ApiError } from "@/lib/api"
import { ACTIVITY_TYPE_LABELS } from "@/types/activity"
import type { Activity, ActivityType } from "@/types/activity"

const ACTIVITY_TYPES = Object.entries(ACTIVITY_TYPE_LABELS) as [ActivityType, string][]

export const activitySchema = z
  .object({
    name: z.string().min(2, "Activity name is required"),
    type: z.enum([
      "wedding", "mehandi", "garba", "haldi", "reception",
      "puja", "sangeet", "engagement", "tilak", "griha_pravesh",
      "naamkaran", "custom",
    ] as const),
    custom_type_name: z.string().optional(),
    date: z.string().min(1, "Date is required"),
    time: z.string().optional(),
    description: z.string().optional(),
  })
  .refine(
    (d) => !(d.type === "custom" && !d.custom_type_name?.trim()),
    { message: "Custom activity name is required", path: ["custom_type_name"] },
  )

export type ActivityFormValues = z.infer<typeof activitySchema>

interface Props {
  /** Required for API mode (create/edit). Omit for draft mode. */
  eventId?: string
  /** Provide to edit an existing activity (API mode only). */
  activity?: Activity
  /** Draft mode: called with form values instead of making an API call. */
  onDraftSubmit?: (values: ActivityFormValues) => void
  onSuccess?: () => void
  onCancel?: () => void
}

export function ActivityForm({ eventId, activity, onDraftSubmit, onSuccess, onCancel }: Props) {
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)

  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      name: activity?.name ?? "",
      type: activity?.type ?? "wedding",
      custom_type_name: activity?.custom_type_name ?? "",
      date: activity?.date ? activity.date.slice(0, 10) : "",
      time: activity?.time ?? "",
      description: activity?.description ?? "",
    },
  })

  const watchedType = form.watch("type")

  async function onSubmit(values: ActivityFormValues) {
    // Draft mode: hand values back to parent without API call
    if (onDraftSubmit) {
      onDraftSubmit(values)
      form.reset()
      return
    }

    if (!eventId) return
    setLoading(true)
    try {
      if (activity) {
        await updateActivity(eventId, activity.id, values)
        toast.success("Activity updated")
      } else {
        await createActivity(eventId, { ...values, guest_ids: [] })
        toast.success("Activity created")
      }
      await queryClient.invalidateQueries({ queryKey: ["activities", eventId] })
      onSuccess?.()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save activity")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Activity Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Mehendi Night, Baraat" {...field} />
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
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ACTIVITY_TYPES.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
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
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {watchedType === "custom" && (
          <FormField
            control={form.control}
            name="custom_type_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Custom Activity Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Sangeet Night" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Time (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="07:00 PM" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Brief note" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : activity ? "Update Activity" : "Add Activity"}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Form>
  )
}
