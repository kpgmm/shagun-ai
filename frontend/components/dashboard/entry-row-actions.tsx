"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { updateEntry, deleteEntry, ApiError } from "@/lib/api"
import type { Entry } from "@/types"

const editSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    village: z.string().min(1, "Village is required"),
    phone: z.string().optional(),
    amount: z.coerce.number().min(0),
    mode: z.enum(["cash", "upi", "gift"]),
    utr_number: z.string().optional(),
    gift_item: z.string().optional(),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode !== "gift" && data.amount <= 0) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Amount must be positive" })
    }
  })
type EditValues = z.infer<typeof editSchema>

interface Props {
  entry: Entry
  eventId: string
}

export function EntryRowActions({ entry, eventId }: Props) {
  const queryClient = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteReason, setDeleteReason] = useState("")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<EditValues, any, EditValues>({
    resolver: zodResolver(editSchema) as any,
    values: {
      name: entry.name,
      village: entry.village,
      phone: entry.phone ?? "",
      amount: entry.amount,
      mode: entry.mode,
      utr_number: entry.utr_number ?? "",
      gift_item: entry.gift_item ?? "",
      notes: entry.notes ?? "",
    },
  })

  const mode = form.watch("mode")

  async function onSave(values: EditValues) {
    setSaving(true)
    try {
      const updated = await updateEntry(eventId, entry.id, values)
      queryClient.setQueryData<Entry[]>(["entries", eventId], (old = []) =>
        old.map((e) => (e.id === updated.id ? updated : e)),
      )
      queryClient.invalidateQueries({ queryKey: ["entries-summary", eventId] })
      toast.success("Entry updated")
      setShowEdit(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update entry")
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!deleteReason.trim()) {
      toast.error("Please provide a reason for deletion")
      return
    }
    setDeleting(true)
    try {
      await deleteEntry(eventId, entry.id, deleteReason.trim())
      queryClient.setQueryData<Entry[]>(["entries", eventId], (old = []) =>
        old.filter((e) => e.id !== entry.id),
      )
      queryClient.invalidateQueries({ queryKey: ["entries-summary", eventId] })
      toast.success("Entry deleted")
      setShowDelete(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete entry")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setShowEdit(true)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => { setDeleteReason(""); setShowDelete(true) }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Edit dialog */}
      <Dialog open={showEdit} onOpenChange={(o) => !o && setShowEdit(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Entry</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="village"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Village</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (optional)</FormLabel>
                    <FormControl>
                      <Input type="tel" inputMode="numeric" maxLength={10} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" inputMode="numeric" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mode</FormLabel>
                      <div className="grid grid-cols-3 gap-1.5 mt-1">
                        {([
                          { key: "cash", label: "💵 Cash" },
                          { key: "upi",  label: "📱 UPI" },
                          { key: "gift", label: "🎁 Gift" },
                        ] as const).map(({ key, label }) => (
                          <button
                            key={key}
                            type="button"
                            className={`rounded-lg border py-2 text-sm font-medium transition-all ${
                              field.value === key
                                ? "border-primary bg-primary text-white"
                                : "border-gray-200 hover:border-primary/50"
                            }`}
                            onClick={() => field.onChange(key)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              {mode === "gift" && (
                <FormField
                  control={form.control}
                  name="gift_item"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gift Item / Description</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Gold ring, Saree…" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

              {mode === "upi" && (
                <FormField
                  control={form.control}
                  name="utr_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UTR Number (optional)</FormLabel>
                      <FormControl><Input placeholder="12-digit UTR" {...field} /></FormControl>
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowEdit(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={showDelete} onOpenChange={(o) => !o && setShowDelete(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Delete entry for <span className="font-medium text-foreground">{entry.name}</span> — ₹{entry.amount.toLocaleString("en-IN")}?
              This cannot be undone.
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Reason for deletion</label>
              <Input
                placeholder="e.g. Duplicate entry, Wrong amount..."
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleting || !deleteReason.trim()}
              onClick={onDelete}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
