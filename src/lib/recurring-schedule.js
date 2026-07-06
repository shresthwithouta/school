/**
 * Recurring-task schedules — pure, client-safe helpers (no DB, no Node APIs).
 *
 * A recurring task is a *single* ongoing assignment (see lib/recurring). Its
 * `schedule` decides which calendar days are "due" — on each due day every
 * assignee is expected to upload a result (a note + optional files). Unlike the
 * old recurring flow, nothing is cloned: the days are computed on demand from
 * the rule below.
 *
 * All date maths is anchored to India Standard Time (the school's locale) so a
 * "due day" lines up with the local calendar day and the Mon–Sat week — not
 * whatever the server's UTC clock says at midnight. IST has no daylight saving,
 * so a civil day is always exactly 24h and the arithmetic stays exact.
 *
 * A "day key" throughout is the IST calendar day as `YYYY-MM-DD`.
 */

/** Schedule frequencies the create form offers, in display order. */
export const SCHEDULE_FREQS = ["daily", "weekdays", "everyN", "weekly"];

/** Short weekday labels, Sunday-first (matches JS `getDay()` 0 = Sunday). */
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const SCHEDULE_META = {
  daily: {
    label: "Daily",
    short: "Daily",
    help: "A result is expected every day.",
  },
  weekdays: {
    label: "Every day except Sunday",
    short: "Mon–Sat",
    help: "A result is expected Monday to Saturday (Sundays are skipped).",
  },
  everyN: {
    label: "Every N days",
    short: "Every N days",
    help: "A result is expected once every N days, counting from the start date.",
  },
  weekly: {
    label: "Weekly (on a chosen day)",
    short: "Weekly",
    help: "A result is expected once a week, on the chosen weekday.",
  },
};

/** How many due days back the log grid renders — keeps columns bounded. */
export const GRID_WINDOW_DAYS = 60;

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000; // +05:30

/** The IST calendar parts (y/m/d and weekday) for a given epoch-ms instant. */
function istParts(ms) {
  const shifted = new Date(ms + IST_OFFSET_MS);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
    dow: shifted.getUTCDay(), // 0 = Sunday … 6 = Saturday (in IST)
  };
}

/** Epoch-ms for 00:00 IST on the given IST calendar day. */
function istMidnightMs(y, m, d) {
  return Date.UTC(y, m, d, 0, 0, 0) - IST_OFFSET_MS;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** The IST day key (`YYYY-MM-DD`) for an epoch-ms instant. */
export function istDayKey(ms) {
  const { y, m, d } = istParts(ms);
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

/** The IST day key for an ISO string (or `null`/empty → ""). */
export function dayKeyOf(iso) {
  if (!iso) return "";
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? "" : istDayKey(ms);
}

/** Today's IST day key. */
export function todayDayKey() {
  return istDayKey(Date.now());
}

/** Parse a `YYYY-MM-DD` day key back to the epoch-ms of 00:00 IST that day. */
export function dayKeyToMs(dayKey) {
  const [y, m, d] = String(dayKey).split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return NaN;
  return istMidnightMs(y, m - 1, d);
}

/** The IST weekday (0 = Sun) of a day key. */
export function weekdayOf(dayKey) {
  return istParts(dayKeyToMs(dayKey)).dow;
}

/** Whole IST days between two day keys (b − a). Negative if b is before a. */
function daysBetween(aKey, bKey) {
  return Math.round((dayKeyToMs(bKey) - dayKeyToMs(aKey)) / DAY_MS);
}

/**
 * Whether `dayKey` is a due day for a schedule that started on `startKey`.
 *   daily     → every day on/after start
 *   weekdays  → every day except Sunday
 *   everyN    → every `intervalDays` from the start day
 *   weekly    → the schedule's chosen weekday
 * Days before the start are never due.
 */
export function isDueOn(schedule, dayKey, startKey) {
  if (!schedule || !dayKey) return false;
  if (startKey && daysBetween(startKey, dayKey) < 0) return false;
  switch (schedule.freq) {
    case "daily":
      return true;
    case "weekdays":
      return weekdayOf(dayKey) !== 0;
    case "everyN": {
      const n = Math.max(1, Number(schedule.intervalDays) || 1);
      if (!startKey) return false;
      return daysBetween(startKey, dayKey) % n === 0;
    }
    case "weekly":
      return weekdayOf(dayKey) === (Number(schedule.weekday) || 0);
    default:
      return false;
  }
}

/**
 * The due day keys for a schedule between `startISO` and `endISO` (inclusive),
 * newest first, capped to `limit` so the grid never renders unbounded columns.
 * `endISO` defaults to today; days past `endISO` (an ended series) are excluded.
 */
export function dueDaysBetween(schedule, startISO, endISO, limit = GRID_WINDOW_DAYS) {
  const startKey = dayKeyOf(startISO) || todayDayKey();
  const today = todayDayKey();
  // Never look past today (no future rows) nor past an explicit end date.
  const endKey = endISO ? minKey(dayKeyOf(endISO), today) : today;
  if (daysBetween(startKey, endKey) < 0) return [];

  const out = [];
  let ms = dayKeyToMs(endKey);
  const startMs = dayKeyToMs(startKey);
  // Walk backwards from the end so we naturally get newest-first and can stop
  // as soon as we've collected `limit` due days.
  while (ms >= startMs && out.length < limit) {
    const key = istDayKey(ms);
    if (isDueOn(schedule, key, startKey)) out.push(key);
    ms -= DAY_MS;
  }
  return out;
}

/** The earlier of two day keys. */
function minKey(a, b) {
  if (!a) return b;
  if (!b) return a;
  return daysBetween(a, b) <= 0 ? a : b;
}

/** True if `freq` is one we know how to schedule. */
export function isScheduleFreq(freq) {
  return SCHEDULE_FREQS.includes(freq);
}

/** A short human label for a schedule, e.g. "Every 3 days" · safe on bad input. */
export function describeSchedule(schedule) {
  if (!schedule || !schedule.freq) return "";
  switch (schedule.freq) {
    case "everyN": {
      const n = Math.max(1, Number(schedule.intervalDays) || 1);
      return n === 1 ? "Daily" : `Every ${n} days`;
    }
    case "weekly": {
      const wd = WEEKDAYS[Number(schedule.weekday) || 0] ?? "Sun";
      return `Weekly · ${wd}`;
    }
    default:
      return SCHEDULE_META[schedule.freq]?.short ?? "";
  }
}

/** Human label for a day key, e.g. "Mon 6 Jul". */
export function formatDayKey(dayKey) {
  const ms = dayKeyToMs(dayKey);
  if (Number.isNaN(ms)) return dayKey;
  const { y, m, d, dow } = istParts(ms);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  void y;
  return `${WEEKDAYS[dow]} ${d} ${months[m]}`;
}
