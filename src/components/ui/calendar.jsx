"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function sameDay(a, b) {
  return (
    !!a &&
    !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// 6×7 day matrix for the month containing `cursor`, week starting Sunday.
function buildMatrix(cursor) {
  const first = startOfMonth(cursor)
  const lead = first.getDay()
  const start = new Date(first)
  start.setDate(first.getDate() - lead)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

/**
 * A self-contained month calendar (no external deps). Controlled by `month`
 * (the displayed month) + `onMonthChange`, and selects single days via
 * `selected` (Date | null) + `onSelect(Date)`.
 */
function Calendar({
  selected,
  onSelect,
  month,
  onMonthChange,
  fromYear,
  toYear,
  className,
}) {
  const today = React.useMemo(() => new Date(), [])
  const cursor = month ?? startOfMonth(selected ?? today)
  const days = React.useMemo(() => buildMatrix(cursor), [cursor])

  const base = today.getFullYear()
  const lo = Math.min(
    fromYear ?? base - 5,
    cursor.getFullYear(),
    selected ? selected.getFullYear() : base
  )
  const hi = Math.max(
    toYear ?? base + 5,
    cursor.getFullYear(),
    selected ? selected.getFullYear() : base
  )
  const years = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)

  const setMonthIndex = (mi) =>
    onMonthChange?.(new Date(cursor.getFullYear(), Number(mi), 1))
  const setYear = (y) =>
    onMonthChange?.(new Date(Number(y), cursor.getMonth(), 1))
  const go = (delta) =>
    onMonthChange?.(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1))

  return (
    <div className={cn("w-fit", className)}>
      {/* Header: ‹  [Month] [Year]  › */}
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => go(-1)}
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="flex flex-1 items-center gap-1.5">
          <Select value={String(cursor.getMonth())} onValueChange={setMonthIndex}>
            <SelectTrigger size="sm" className="h-7 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-60">
              {MONTHS.map((m, idx) => (
                <SelectItem key={m} value={String(idx)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(cursor.getFullYear())} onValueChange={setYear}>
            <SelectTrigger size="sm" className="h-7 w-[4.75rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-60">
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => go(1)}
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Weekday header */}
      <div className="mt-3 grid grid-cols-7">
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            className="flex h-8 w-9 items-center justify-center text-[0.7rem] font-medium text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth()
          const isToday = sameDay(d, today)
          const isSelected = sameDay(d, selected)
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect?.(d)}
              aria-pressed={isSelected}
              className={cn(
                "flex size-9 items-center justify-center rounded-md text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                !inMonth && "text-muted-foreground/40",
                inMonth &&
                  !isSelected &&
                  "hover:bg-accent hover:text-accent-foreground",
                isToday &&
                  !isSelected &&
                  "bg-accent/60 font-semibold text-foreground",
                isSelected &&
                  "bg-primary font-medium text-primary-foreground hover:bg-primary/90"
              )}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export { Calendar }
