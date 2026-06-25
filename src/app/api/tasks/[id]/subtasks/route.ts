import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { createSubtaskSchema } from "@/lib/validation";
import { addSubtask } from "@/lib/tasks";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const input = createSubtaskSchema.parse(await req.json());
    const task = await addSubtask(actor, id, input);
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
