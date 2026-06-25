import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { joinMeeting } from "@/lib/meetings";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const meeting = await joinMeeting(actor, id);
    return NextResponse.json({ meeting });
  } catch (err) {
    return handleApiError(err);
  }
}
