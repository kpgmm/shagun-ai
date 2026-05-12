import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="text-6xl">🌸</div>
      <h2 className="text-2xl font-bold">Page not found</h2>
      <p className="text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link href="/events">
        <Button>Go to Events</Button>
      </Link>
    </div>
  )
}
