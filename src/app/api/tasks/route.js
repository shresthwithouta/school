import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { createTaskSchema } from "@/lib/validation";
import { createTask, listVisibleTasks } from "@/lib/tasks";

export async function GET() {
  try {
    const actor = await requireApiUser();
    const tasks = await listVisibleTasks(actor);
    return NextResponse.json({ tasks });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req) {
  try {
    const actor = await requireApiUser();
    const input = createTaskSchema.parse(await req.json());
    const task = await createTask(actor, input);
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
