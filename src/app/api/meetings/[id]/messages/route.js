import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { meetingMessageSchema } from "@/lib/validation";
import { addMeetingMessage } from "@/lib/meetings";

export async function POST(
  req,
  { params }
) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const input = meetingMessageSchema.parse(await req.json());
    const meeting = await addMeetingMessage(
      actor,
      id,
      input.text ?? "",
      input.attachments
    );
    return NextResponse.json({ meeting });
  } catch (err) {
    return handleApiError(err);
  }
}
