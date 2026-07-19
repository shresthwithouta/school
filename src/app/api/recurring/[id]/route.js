import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { updateRecurringSchema } from "@/lib/validation";
import {
  deleteRecurring,
  getRecurringForActor,
  updateRecurring,
} from "@/lib/recurring";

export async function GET(_req, { params }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const recurring = await getRecurringForActor(actor, id);
    if (!recurring) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ recurring });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req, { params }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const input = updateRecurringSchema.parse(await req.json());
    const recurring = await updateRecurring(actor, id, input);
    return NextResponse.json({ recurring });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req, { params }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    await deleteRecurring(actor, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
