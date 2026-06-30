import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { saveSubscription, sendPushToUser } from "@/lib/push";

// Stores (or refreshes) the calling user's Web Push subscription for this
// device. The browser sends the result of `pushSubscription.toJSON()`.
export async function POST(req) {
  try {
    const actor = await requireApiUser();
    const body = await req.json();
    const subscription = body?.subscription;

    await saveSubscription(actor.id, subscription, req.headers.get("user-agent") || "");

    // On an explicit user-initiated enable, send one confirmation push so they
    // see right away that it works (skipped on silent re-syncs from page load).
    if (body?.welcome) {
      await sendPushToUser(actor.id, {
        title: "Notifications on 🔔",
        body: "You'll be notified here about tasks, subtasks and meetings.",
        url: "/dashboard",
        tag: "swm-welcome",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
