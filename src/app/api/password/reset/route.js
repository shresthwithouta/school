import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { resetPasswordSchema } from "@/lib/validation";
import { resetPasswordWithToken } from "@/lib/users";

// Public: the single-use emailed token is the credential.
export async function POST(req) {
  try {
    const body = await req.json();
    const input = resetPasswordSchema.parse(body);
    await resetPasswordWithToken(input.token, input.newPassword);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
