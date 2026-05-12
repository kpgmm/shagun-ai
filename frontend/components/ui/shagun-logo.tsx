"use client"

import { cn } from "@/lib/utils"

interface Props {
  /**
   * "lg" — auth pages: bloom entrance + continuous float + saffron glow
   * "sm" — navbar: subtle continuous float, no entrance animation
   */
  size?: "lg" | "sm"
  className?: string
}

export function ShagunLogo({ size = "lg", className }: Props) {
  const isLarge = size === "lg"

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block select-none",
        isLarge ? "text-5xl" : "text-2xl",
        className,
      )}
      style={{
        animation: isLarge
          ? "shagun-bloom 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both, shagun-float 3.2s ease-in-out 0.7s infinite"
          : "shagun-nav-float 3.8s ease-in-out infinite",
        willChange: "transform, filter",
        display: "inline-block",
      }}
    >
      🌸
    </span>
  )
}
