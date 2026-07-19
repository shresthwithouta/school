import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { createRecurringSchema } from "@/lib/validation";
import { createRecurring, listVisibleRecurring } from "@/lib/recurring";

export async function GET() {
  try {
    const actor = await requireApiUser();
    const recurring = await listVisibleRecurring(actor);
    return NextResponse.json({ recurring });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req) {
  try {
    const actor = await requireApiUser();
    const input = createRecurringSchema.parse(await req.json());
    const recurring = await createRecurring(actor, input);
    return NextResponse.json({ recurring }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
