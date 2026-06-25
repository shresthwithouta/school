import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { updateTaskSchema } from "@/lib/validation";
import { deleteTask, getTaskForActor, updateTask } from "@/lib/tasks";

export async function GET(
  _req,
  { params }
) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const task = await getTaskForActor(actor, id);
    if (!task) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ task });
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
    const input = updateTaskSchema.parse(await req.json());
    const task = await updateTask(actor, id, input);
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
    const { id } = await params;
    await deleteTask(actor, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
