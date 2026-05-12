"use client"

import { QrCode, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Props {
  qrImageUrl: string
  eventName: string
  hostName: string
  hostVillage: string
}

export function QrDisplay({ qrImageUrl, eventName, hostName, hostVillage }: Props) {
  function handlePrint() {
    const win = window.open("", "_blank")
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>Shagun QR — ${eventName}</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 40px; }
            img { width: 300px; height: 300px; }
            h2 { color: #F97316; margin-bottom: 4px; }
            p { color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <h2>${eventName}</h2>
          <p>${hostName} · ${hostVillage}</p>
          <img src="${qrImageUrl}" alt="UPI QR Code" />
          <p style="margin-top:16px;">Scan to pay shagun via UPI</p>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <Card className="max-w-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <QrCode className="h-4 w-4 text-primary" />
          UPI Payment QR
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrImageUrl}
            alt="UPI QR Code"
            className="w-56 h-56 rounded-lg border"
          />
        </div>
        <p className="text-xs text-center text-muted-foreground">
          Display at entrance — guests scan to pay
        </p>
        <Button variant="outline" className="w-full gap-2" onClick={handlePrint}>
          <Printer className="h-4 w-4" />
          Print QR
        </Button>
      </CardContent>
    </Card>
  )
}
