import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { getCurrentUser } from "@/lib/session";
import { isOwner } from "@/lib/rbac";
import { sendUpcomingDueReminders } from "@/lib/tasks";
import { sendMeetingReminders } from "@/lib/meetings";

// Emails/pushes assignees whose task or subtask deadline is coming up soon
// (see sendUpcomingDueReminders in lib/tasks) and attendees whose meeting is
// starting soon (see sendMeetingReminders in lib/meetings). Meant to be
// triggered frequently (e.g. every 15 minutes — see vercel.json) since these
// are short, minute/hour-scale windows rather than the once-a-day sweep in
// /api/cron/delayed-tasks.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Authorized either by the shared cron secret (Vercel Cron sends it as a Bearer
// token automatically when CRON_SECRET is set; an external scheduler can send
// the same header) or by a signed-in Owner triggering a manual catch-up.
async function authorize(req) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return;
  const user = await getCurrentUser();
  if (user && isOwner(user.role)) return;
  throw new AppError("Not authorized.", 401);
}

async function run(req) {
  try {
    await authorize(req);
    const [tasks, meetings] = await Promise.all([
      sendUpcomingDueReminders(),
      sendMeetingReminders(),
    ]);
    return NextResponse.json({ ok: true, tasks, meetings });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET(req) {
  return run(req);
}

export async function POST(req) {
  return run(req);
}
