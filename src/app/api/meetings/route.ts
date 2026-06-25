import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { createMeetingSchema } from "@/lib/validation";
import { createMeeting, listVisibleMeetings } from "@/lib/meetings";

export async function GET() {
  try {
    const actor = await requireApiUser();
    const meetings = await listVisibleMeetings(actor);
    return NextResponse.json({ meetings });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireApiUser();
    const input = createMeetingSchema.parse(await req.json());
    const meeting = await createMeeting(actor, input);
    return NextResponse.json({ meeting }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
