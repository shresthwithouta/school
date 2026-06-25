import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { decisionSchema } from "@/lib/validation";
import { addDecision } from "@/lib/meetings";

export async function POST(req, { params }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const input = decisionSchema.parse(await req.json());
    const meeting = await addDecision(actor, id, input.text, input.dueDate);
    return NextResponse.json({ meeting }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
