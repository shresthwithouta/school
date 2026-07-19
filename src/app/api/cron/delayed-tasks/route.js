import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { getCurrentUser } from "@/lib/session";
import { isOwner } from "@/lib/rbac";
import { sendDelayedTaskReminders } from "@/lib/tasks";

// Emails/pushes every assignee still holding open work on a task or subtask
// that's now past its due date (see sendDelayedTaskReminders in lib/tasks).
// Triggered by a daily scheduler (Vercel Cron — see vercel.json — or any
// external cron hitting this URL). Uses the DB, so it must run on Node.
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
    const result = await sendDelayedTaskReminders();
    return NextResponse.json({ ok: true, ...result });
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
