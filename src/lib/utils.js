import { clsx, } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/** Strips HTML tags to a plain-text string (for previews/excerpts). */
export function toPlainText(html) {
  if (!html) return ""
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
}

/** Human-friendly duration from a number of hours (e.g. 0.5h → "30m", 30h → "1.3d"). */
export function formatHours(h) {
  if (h == null) return "—"
  if (h < 1) return `${Math.round(h * 60)}m`
  if (h < 24) return `${h}h`
  return `${(h / 24).toFixed(1)}d`
}

/** Up to two uppercase initials from a person's name (falls back to "?"). */
export function getInitials(name) {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** "12 Jun 2026" style date, safe for null/undefined. */
export function formatDate(date) {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

/** "12 Jun, 14:30" style date+time, safe for null/undefined. */
export function formatDateTime(date) {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}
