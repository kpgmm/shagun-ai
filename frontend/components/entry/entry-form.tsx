"use client"

import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { api, ApiError } from "@/lib/api"
import { formatIndianCurrency } from "@/lib/utils"
import type { Guest } from "@/types"

const schema = z
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

type FormValues = z.infer<typeof schema>

const AMOUNT_PRESETS = [101, 201, 501, 1001, 1100, 2100, 5001]

export function EntryForm({ eventId, activityId }: { eventId: string; activityId?: string }) {
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<"cash" | "upi" | "gift">("cash")
  const [nameInput, setNameInput] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)

  const { data: guests = [] } = useQuery<Guest[]>({
    queryKey: ["guests", eventId],
    queryFn: () => api.get<Guest[]>(`/api/events/${eventId}/guests`),
  })

  const suggestions = useMemo(() => {
    if (nameInput.length < 2) return []
    const q = nameInput.toLowerCase()
    return guests
      .filter((g) => g.name.toLowerCase().includes(q) || g.village.toLowerCase().includes(q))
      .slice(0, 5)
  }, [nameInput, guests])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<FormValues, any, FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: "",
      village: "",
      phone: "",
      amount: 0,
      mode: "cash",
      utr_number: "",
      gift_item: "",
      notes: "",
    },
  })

  function selectGuest(g: Guest) {
    form.setValue("name", g.name)
    form.setValue("village", g.village)
    form.setValue("phone", g.phone)
    setNameInput(g.name)
    setShowSuggestions(false)
  }

  function switchMode(m: "cash" | "upi" | "gift") {
    setMode(m)
    form.setValue("mode", m)
    if (m === "gift") form.setValue("amount", 0)
  }

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      await api.post(`/api/events/${eventId}/entries`, {
        ...values,
        mode,
        ...(activityId ? { activity_id: activityId } : {}),
      })
      const label =
        mode === "gift"
          ? `Gift — ${values.gift_item || "item recorded"}`
          : `${formatIndianCurrency(values.amount)} (${mode.toUpperCase()})`
      toast.success(`Entry saved — ${label}`)
      form.reset()
      setNameInput("")
      setShowSuggestions(false)
      setMode("cash")
      queryClient.invalidateQueries({ queryKey: ["entries-summary", eventId] })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save entry")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

        {/* Name + Village — two columns */}
        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Guest Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Name or village..."
                      className="h-10 text-sm"
                      {...field}
                      value={nameInput}
                      onChange={(e) => {
                        setNameInput(e.target.value)
                        field.onChange(e.target.value)
                        setShowSuggestions(true)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-10 w-full rounded-b-lg border border-t-0 bg-white shadow-lg">
                {suggestions.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted"
                    onClick={() => selectGuest(g)}
                  >
                    <div>
                      <p className="font-medium text-sm">{g.name}</p>
                      <p className="text-xs text-muted-foreground">{g.village} · {g.phone}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <FormField
            control={form.control}
            name="village"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Village / City</FormLabel>
                <FormControl>
                  <Input placeholder="Village name" className="h-10 text-sm" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Payment Mode — compact pill tabs */}
        <div>
          <p className="text-sm font-medium mb-2 text-foreground">Payment Mode</p>
          <div className="flex rounded-lg border overflow-hidden text-sm font-medium">
            {([
              { key: "cash", label: "💵 Cash" },
              { key: "upi",  label: "📱 UPI" },
              { key: "gift", label: "🎁 Gift" },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`flex-1 py-2 transition-colors ${
                  mode === key
                    ? "bg-primary text-white"
                    : "hover:bg-muted text-muted-foreground"
                }`}
                onClick={() => switchMode(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Gift Item — shown only for gift mode */}
        {mode === "gift" && (
          <FormField
            control={form.control}
            name="gift_item"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Gift Item / Description</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. Gold ring, Silver coins, Saree..."
                    className="h-10 text-sm"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Amount */}
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm">
                {mode === "gift" ? "Estimated Value (₹) — optional" : "Amount (₹)"}
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  className="h-12 text-2xl font-bold text-center"
                  {...field}
                />
              </FormControl>
              {mode !== "gift" && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {AMOUNT_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="rounded-md border px-2.5 py-1 text-sm hover:bg-muted hover:border-primary transition-colors"
                      onClick={() => form.setValue("amount", p)}
                    >
                      ₹{p.toLocaleString("en-IN")}
                    </button>
                  ))}
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {mode === "upi" && (
          <FormField
            control={form.control}
            name="utr_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">UTR Number (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="12-digit UTR" className="h-10 text-sm" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm">Notes (optional)</FormLabel>
              <FormControl>
                <Input placeholder="Any additional notes" className="h-10 text-sm" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full h-11 text-base font-bold"
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Entry ✓"}
        </Button>
      </form>
    </Form>
  )
}
