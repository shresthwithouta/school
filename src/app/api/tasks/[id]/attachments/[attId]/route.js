import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { removeTaskAttachment } from "@/lib/tasks";

export async function DELETE(
  _req,
  { params }
) {
  try {
    const actor = await requireApiUser();
    const { id, attId } = await params;
    const task = await removeTaskAttachment(actor, id, attId);
    return NextResponse.json({ task });
  } catch (err) {
    return handleApiError(err);
  }
}
