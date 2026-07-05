/**
 * Recurring tasks — pure, client-safe helpers (no DB, no Node APIs).
 *
 * A recurring task is a *template*: the task the creator saves is its first
 * occurrence and also carries the recurrence rule. A daily job (see
 * spawnDueRecurringTasks in lib/tasks) clones a fresh occurrence each period and
 * emails the assignees. Occurrences are ordinary tasks with no recurrence rule.
 *
 * All date maths is anchored to India Standard Time (the school's locale) so
 * "a new task every day" lines up with the local calendar day and the
 * Mon–Sat week — not whatever the server's UTC clock says at midnight. IST has
 * no daylight saving, so a civil day is always exactly 24h and the arithmetic
 * below stays exact.
 */

/** Frequencies the "Recurring" toggle offers, in display order. */
export const RECURRENCE_FREQS = ["daily", "weekdays"];

export const RECURRENCE_META = {
  daily: {
    label: "Daily",
    short: "Daily",
    help: "A new task every day.",
  },
  weekdays: {
    label: "Every day except Sunday",
    short: "Mon–Sat",
    help: "A new task Monday to Saturday (Sundays are skipped).",
  },
};

/** True if `freq` is one we know how to schedule. */
export function isRecurrenceFreq(freq) {
  return RECURRENCE_FREQS.includes(freq);
}

/** A short human label for a rule, e.g. "Daily" — safe on empty/unknown input. */
export function describeRecurrence(rec) {
  if (!rec || !rec.freq) return "";
  return RECURRENCE_META[rec.freq]?.short ?? "";
}

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

/** The IST weekday (0 = Sun) of an epoch-ms instant. */
function istDow(ms) {
  return new Date(ms + IST_OFFSET_MS).getUTCDay();
}

/**
 * The next spawn instant strictly after `fromISO`, as an ISO string. Always the
 * start of a later IST day; for "weekdays" Sundays are skipped so the run lands
 * on Mon–Sat. Because it advances relative to *now*, a job that missed a day (or
 * several) simply resumes with the current day rather than back-filling a flood.
 */
export function computeNextRun(freq, fromISO) {
  const fromMs = Date.parse(fromISO);
  const { y, m, d } = istParts(fromMs);
  let next = istMidnightMs(y, m, d) + DAY_MS; // 00:00 IST tomorrow
  if (freq === "weekdays") {
    while (istDow(next) === 0) next += DAY_MS; // never a Sunday
  }
  return new Date(next).toISOString();
}

/**
 * When an occurrence generated *for* the day of `forISO` is due: the end of that
 * IST day (23:59 IST). Keeps the "delayed" derivation meaningful — a daily task
 * not done by day's end shows as overdue the next morning.
 */
export function occurrenceDueFor(forISO) {
  const { y, m, d } = istParts(Date.parse(forISO));
  const endOfDay = istMidnightMs(y, m, d) + DAY_MS - 60_000; // 23:59 IST
  return new Date(endOfDay).toISOString();
}
