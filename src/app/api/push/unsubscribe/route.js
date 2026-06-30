import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { removeSubscription } from "@/lib/push";

// Removes this device's subscription when the user turns notifications off.
export async function POST(req) {
  try {
    const actor = await requireApiUser();
    const body = await req.json();
    await removeSubscription(actor.id, body?.endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
