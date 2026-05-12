"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, ApiError } from "@/lib/api"
import type { Guest, RelationSide } from "@/types"

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().regex(/^\d{10}$/, "Enter 10-digit phone number"),
  village: z.string().min(1, "Village is required"),
  relation_side: z.enum(["mama_pakkhu", "kaka_pakkhu", "friend", "colleague", "other"]),
})

type FormValues = z.infer<typeof schema>

const RELATIONS = [
  { value: "mama_pakkhu", label: "Mama Pakkhu (Maternal)" },
  { value: "kaka_pakkhu", label: "Kaka Pakkhu (Paternal)" },
  { value: "friend", label: "Friend" },
  { value: "colleague", label: "Colleague" },
  { value: "other", label: "Other" },
]

interface Props {
  eventId: string
  guest?: Guest
  open: boolean
  onClose: () => void
}

export function GuestForm({ eventId, guest, open, onClose }: Props) {
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: guest?.name ?? "",
      phone: guest?.phone ?? "",
      village: guest?.village ?? "",
      relation_side: (guest?.relation_side as RelationSide) ?? "other",
    },
  })

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      if (guest) {
        await api.put(`/api/events/${eventId}/guests/${guest.id}`, values)
        toast.success("Guest updated")
      } else {
        await api.post(`/api/events/${eventId}/guests`, values)
        toast.success("Guest added")
      }
      await queryClient.invalidateQueries({ queryKey: ["guests", eventId] })
      onClose()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to save guest"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{guest ? "Edit Guest" : "Add Guest"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Guest full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="10-digit mobile number"
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
            <FormField
              control={form.control}
              name="village"
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
            <FormField
              control={form.control}
              name="relation_side"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Relation Side</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select relation" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {RELATIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : guest ? "Update" : "Add Guest"}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
