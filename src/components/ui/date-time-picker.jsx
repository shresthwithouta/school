"use client"

import * as React from "react"
import { CalendarIcon, Clock, X } from "lucide-react"

import { cn, formatDate, formatDateTime } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function parse(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

const pad = (n) => String(n).padStart(2, "0")
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5) // 0,5,…,55

/**
 * Date (and optional time) picker built on Popover + Calendar. Emits an ISO
 * string via `onChange`, or "" when cleared — round-trips cleanly through the
 * existing `new Date(value).toISOString()` API layer.
 *
 * - mode="datetime" (default): a date, with an "Add time" button to attach a
 *   time. Pass `alwaysTime` to keep the time controls always visible (meetings).
 * - mode="date": date only.
 */
export function DateTimePicker({
  value,
  onChange,
  mode = "datetime",
  alwaysTime = false,
  placeholder = "Pick a date",
  id,
  disabled,
  className,
  align = "start",
}) {
  const withTime = mode === "datetime"
  const today = React.useMemo(() => new Date(), [])
  const selected = React.useMemo(() => parse(value), [value])

  const hasTime =
    withTime &&
    !!selected &&
    (selected.getHours() !== 0 || selected.getMinutes() !== 0)

  const [open, setOpen] = React.useState(false)
  const [month, setMonth] = React.useState(() =>
    startOfMonth(selected ?? today)
  )
  const [showTime, setShowTime] = React.useState(
    () => withTime && (alwaysTime || hasTime)
  )

  const displayTime = withTime && (alwaysTime || hasTime)
  const hour = selected ? selected.getHours() : 9
  const minute = selected ? selected.getMinutes() : 0
  const minuteOptions = MINUTES.includes(minute)
    ? MINUTES
    : [...MINUTES, minute].sort((a, b) => a - b)

  function emit(date) {
    onChange?.(date ? date.toISOString() : "")
  }

  function handleOpenChange(next) {
    setOpen(next)
    if (next) {
      setMonth(startOfMonth(selected ?? today))
      setShowTime(withTime && (alwaysTime || hasTime))
    }
  }

  function pickDay(day) {
    const useTime = withTime && showTime
    const next = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      useTime ? hour : 0,
      useTime ? minute : 0,
      0,
      0
    )
    emit(next)
    if (!withTime) setOpen(false)
  }

  function setTime(h, m) {
    const day = selected ?? today
    emit(new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0))
  }

  function enableTime() {
    setShowTime(true)
    const day = selected ?? today
    emit(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0, 0, 0))
  }

  function disableTime() {
    setShowTime(false)
    if (selected) {
      emit(
        new Date(
          selected.getFullYear(),
          selected.getMonth(),
          selected.getDate(),
          0,
          0,
          0,
          0
        )
      )
    }
  }

  function pickToday() {
    const useTime = withTime && showTime
    emit(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        useTime ? today.getHours() : 0,
        useTime ? today.getMinutes() : 0,
        0,
        0
      )
    )
    setMonth(startOfMonth(today))
  }

  function clear() {
    emit(null)
    setShowTime(alwaysTime)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={!selected}
          className={cn(
            "h-8 w-full justify-start gap-2 px-2.5 font-normal data-[empty=true]:text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="size-4 shrink-0 opacity-70" />
          <span className="truncate">
            {selected
              ? displayTime
                ? formatDateTime(selected)
                : formatDate(selected)
              : placeholder}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align={align} className="w-auto p-0">
        <Calendar
          selected={selected}
          onSelect={pickDay}
          month={month}
          onMonthChange={setMonth}
          className="p-3"
        />

        {withTime && (
          <div className="border-t p-3">
            {showTime ? (
              <div className="flex items-center gap-2">
                <Clock className="size-4 shrink-0 text-muted-foreground" />
                <Select value={String(hour)} onValueChange={(v) => setTime(Number(v), minute)}>
                  <SelectTrigger size="sm" className="h-8 w-16">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-52">
                    {HOURS.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {pad(h)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground">:</span>
                <Select value={String(minute)} onValueChange={(v) => setTime(hour, Number(v))}>
                  <SelectTrigger size="sm" className="h-8 w-16">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-52">
                    {minuteOptions.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {pad(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!alwaysTime && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="ml-auto text-muted-foreground"
                    onClick={disableTime}
                    aria-label="Remove time"
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={enableTime}
              >
                <Clock className="size-3.5" />
                Add time
              </Button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={clear}
            disabled={!selected}
          >
            Clear
          </Button>
          <div className="flex items-center gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={pickToday}>
              Today
            </Button>
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
