import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { commentSchema } from "@/lib/validation";
import { addComment } from "@/lib/tasks";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const input = commentSchema.parse(await req.json());
    const task = await addComment(actor, id, input.text, input.parentId || null);
    return NextResponse.json({ task });
  } catch (err) {
    return handleApiError(err);
  }
}
