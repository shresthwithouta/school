import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { updateMeetingSchema } from "@/lib/validation";
import { deleteMeeting, getMeetingForActor, updateMeeting } from "@/lib/meetings";

export async function GET(
  _req,
  { params }
) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const meeting = await getMeetingForActor(actor, id);
    if (!meeting) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ meeting });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  req,
  { params }
) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const input = updateMeetingSchema.parse(await req.json());
    const meeting = await updateMeeting(actor, id, input);
    return NextResponse.json({ meeting });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req,
  { params }
) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    await deleteMeeting(actor, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
