import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { transitionSchema } from "@/lib/validation";
import { transitionTask } from "@/lib/tasks";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const input = transitionSchema.parse(await req.json());
    const task = await transitionTask(actor, id, input);
    return NextResponse.json({ task });
  } catch (err) {
    return handleApiError(err);
  }
}
