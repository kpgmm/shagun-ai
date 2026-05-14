import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { HelpCircle, LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ShagunLogo } from "@/components/ui/shagun-logo"

async function getUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get("access_token")
  if (!token) return null

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/auth/me`, {
      headers: { Cookie: `access_token=${token.value}` },
      cache: "no-store",
    })
    const json = await res.json()
    if (!json.success) return null
    return json.data
  } catch {
    return null
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect("/login")

  return (
    <div className="min-h-screen bg-background">
      {/* Top navigation */}
      <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-3">
          <Link href="/events" className="flex items-center gap-2">
            <ShagunLogo size="sm" />
            <span className="text-xl font-bold text-primary">Shagun</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/help"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <HelpCircle className="h-4 w-4" />
              <span className="hidden sm:block">Help</span>
            </Link>
            <span className="hidden text-sm text-muted-foreground sm:block">
              {user.name}
            </span>
            <form action="/api/auth/logout-action" method="post">
              <LogoutButton />
            </form>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-screen-2xl px-6 py-6">{children}</main>
    </div>
  )
}

// Client component for logout (needs onClick)
function LogoutButton() {
  return (
    <Link href="/login">
      <Button variant="ghost" size="sm" className="gap-2">
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:block">Sign out</span>
      </Button>
    </Link>
  )
}
