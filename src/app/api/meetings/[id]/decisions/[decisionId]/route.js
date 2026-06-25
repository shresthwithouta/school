import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { decisionUpdateSchema } from "@/lib/validation";
import { setDecisionDone, deleteDecision } from "@/lib/meetings";

export async function PATCH(req, { params }) {
  try {
    const actor = await requireApiUser();
    const { id, decisionId } = await params;
    const input = decisionUpdateSchema.parse(await req.json());
    const meeting = await setDecisionDone(actor, id, decisionId, input.done);
    return NextResponse.json({ meeting });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req, { params }) {
  try {
    const actor = await requireApiUser();
    const { id, decisionId } = await params;
    await deleteDecision(actor, id, decisionId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
