import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { attachmentSchema } from "@/lib/validation";
import { addTaskAttachment } from "@/lib/tasks";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const input = attachmentSchema.parse(await req.json());
    const task = await addTaskAttachment(actor, id, input);
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
