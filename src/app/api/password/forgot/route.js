import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { forgotPasswordSchema } from "@/lib/validation";
import { requestPasswordReset } from "@/lib/users";

// Public: always answers { ok: true } for a well-formed email so the response
// never reveals whether an account exists.
export async function POST(req) {
  try {
    const body = await req.json();
    const { email } = forgotPasswordSchema.parse(body);
    await requestPasswordReset(email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
