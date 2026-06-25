import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { updateSubtaskSchema } from "@/lib/validation";
import { deleteSubtask, updateSubtask } from "@/lib/tasks";

export async function PATCH(
  req,
  { params }
) {
  try {
    const actor = await requireApiUser();
    const { id, subId } = await params;
    const input = updateSubtaskSchema.parse(await req.json());
    const task = await updateSubtask(actor, id, subId, input);
    return NextResponse.json({ task });
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
    const { id, subId } = await params;
    const task = await deleteSubtask(actor, id, subId);
    return NextResponse.json({ task });
  } catch (err) {
    return handleApiError(err);
  }
}
