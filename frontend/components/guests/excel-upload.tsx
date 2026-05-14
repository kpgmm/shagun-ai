"use client"

import { useRef, useState } from "react"
import * as XLSX from "@e965/xlsx"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { Upload, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, ApiError } from "@/lib/api"

const RELATION_OPTIONS = [
  { value: "close_family",       label: "Close Family & Relatives" },
  { value: "social_obligations", label: "Social Obligations" },
  { value: "friend",             label: "Friends" },
  { value: "colleague",          label: "Colleagues" },
  { value: "other",              label: "Other" },
  { value: "custom",             label: "Custom" },
]

interface ParsedRow {
  name: string
  phone: string
  village: string
  relation_side: string
}

interface Props {
  eventId: string
  open: boolean
  onClose: () => void
}

export function ExcelUpload({ eventId, open, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({
    name: "",
    phone: "",
    village: "",
    relation_side: "",
  })
  const [preview, setPreview] = useState<ParsedRow[]>([])
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload")
  const [loading, setLoading] = useState(false)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = ev.target?.result
      const wb = XLSX.read(data, { type: "array" })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: "" })
      if (json.length === 0) {
        toast.error("No data found in file")
        return
      }
      setHeaders(Object.keys(json[0]))
      setRows(json)
      // Auto-map: try to guess columns by name
      const autoMap: Record<string, string> = { name: "", phone: "", village: "", relation_side: "" }
      const hdrs = Object.keys(json[0]).map((h) => h.toLowerCase())
      for (const key of Object.keys(autoMap)) {
        const idx = hdrs.findIndex((h) => h.includes(key) || h.includes(key.replace("_", "")))
        if (idx !== -1) autoMap[key] = Object.keys(json[0])[idx]
      }
      setMapping(autoMap)
      setStep("map")
    }
    reader.readAsArrayBuffer(file)
  }

  function buildPreview() {
    const parsed = rows.slice(0, 100).map((row) => ({
      name: String(row[mapping.name] ?? ""),
      phone: String(row[mapping.phone] ?? "").replace(/\D/g, "").slice(-10),
      village: String(row[mapping.village] ?? ""),
      relation_side: mapping.relation_side ? String(row[mapping.relation_side] ?? "other") : "other",
    }))
    setPreview(parsed)
    setStep("preview")
  }

  async function handleUpload() {
    setLoading(true)
    try {
      const result = await api.post<{ inserted: number; skipped: number }>(
        `/api/events/${eventId}/guests/bulk`,
        preview,
      )
      toast.success(`Added ${result.inserted} guests${result.skipped ? `, skipped ${result.skipped} duplicates` : ""}`)
      await queryClient.invalidateQueries({ queryKey: ["guests", eventId] })
      setStep("done")
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Upload failed"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setStep("upload")
    setHeaders([])
    setRows([])
    setPreview([])
    if (fileRef.current) fileRef.current.value = ""
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload Guests</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-12 gap-4">
            <Upload className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              Upload an Excel (.xlsx) or CSV file with guest details
              <br />
              Required columns: Name, Phone, Village
            </p>
            <Button onClick={() => fileRef.current?.click()}>Choose File</Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFile}
            />
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Map your file columns to the required fields ({rows.length} rows found)
            </p>
            {(["name", "phone", "village", "relation_side"] as const).map((field) => (
              <div key={field} className="flex items-center gap-4">
                <span className="w-32 text-sm font-medium capitalize">
                  {field.replace("_", " ")}
                  {field !== "relation_side" && <span className="text-destructive ml-1">*</span>}
                </span>
                <Select
                  value={mapping[field]}
                  onValueChange={(v) => setMapping((m) => ({ ...m, [field]: v }))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— skip —</SelectItem>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <Button onClick={buildPreview} disabled={!mapping.name || !mapping.phone}>
                Preview
              </Button>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Showing {preview.length} of {rows.length} guests — review before uploading
            </p>
            <div className="rounded border overflow-x-auto max-h-64">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Village</TableHead>
                    <TableHead>Relation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.slice(0, 20).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.phone}</TableCell>
                      <TableCell>{row.village}</TableCell>
                      <TableCell>{row.relation_side}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {preview.length > 20 && (
              <p className="text-xs text-muted-foreground">... and {preview.length - 20} more</p>
            )}
            <div className="flex gap-3">
              <Button onClick={handleUpload} disabled={loading}>
                {loading ? "Uploading..." : `Upload ${preview.length} Guests`}
              </Button>
              <Button variant="outline" onClick={() => setStep("map")}>
                Back
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="text-lg font-medium">Upload complete!</p>
            <Button onClick={handleClose}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
