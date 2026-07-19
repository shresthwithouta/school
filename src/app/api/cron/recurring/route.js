import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { getCurrentUser } from "@/lib/session";
import { isOwner } from "@/lib/rbac";
import { sendRecurringReminders } from "@/lib/recurring";

// Reminds every assignee who hasn't uploaded today's result for an active
// recurring task (see lib/recurring). Recurring tasks are now a single ongoing
// assignment with a per-day upload log — nothing is cloned. Triggered by a daily
// scheduler (Vercel Cron — see vercel.json — or any external cron hitting this
// URL). Uses the DB, so it must run on Node, not the Edge runtime.
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
    const result = await sendRecurringReminders();
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
