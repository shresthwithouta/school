import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { recurringEntrySchema } from "@/lib/validation";
import { deleteEntry, upsertEntry } from "@/lib/recurring";

// Create or replace the actor's result for a given due day (defaults to today).
export async function POST(req, { params }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const input = recurringEntrySchema.parse(await req.json());
    const recurring = await upsertEntry(actor, id, input);
    return NextResponse.json({ recurring });
  } catch (err) {
    return handleApiError(err);
  }
}

// Remove one entry (own, or creator/manager). Entry id in the JSON body.
export async function DELETE(req, { params }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const entryId = String(body?.entryId || "");
    if (!entryId) return NextResponse.json({ error: "Missing entry id." }, { status: 400 });
    const recurring = await deleteEntry(actor, id, entryId);
    return NextResponse.json({ recurring });
  } catch (err) {
    return handleApiError(err);
  }
}
