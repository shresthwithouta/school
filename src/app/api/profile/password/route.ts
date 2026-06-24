import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { changePasswordSchema } from "@/lib/validation";
import { changeOwnPassword } from "@/lib/users";

export async function POST(req: Request) {
  try {
    const actor = await requireApiUser();
    const body = await req.json();
    const input = changePasswordSchema.parse(body);
    await changeOwnPassword(actor.id, input.currentPassword, input.newPassword);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
