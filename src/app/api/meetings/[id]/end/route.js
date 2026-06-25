import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { endMeetingSchema } from "@/lib/validation";
import { endMeeting } from "@/lib/meetings";

export async function POST(
  req,
  { params }
) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const input = endMeetingSchema.parse(await req.json());
    const meeting = await endMeeting(actor, id, input.summary ?? "");
    return NextResponse.json({ meeting });
  } catch (err) {
    return handleApiError(err);
  }
}
