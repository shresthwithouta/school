import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { createUserSchema } from "@/lib/validation";
import { createUser, listVisibleUsers } from "@/lib/users";

export async function GET() {
  try {
    const actor = await requireApiUser();
    const users = await listVisibleUsers(actor);
    return NextResponse.json({ users });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req) {
  try {
    const actor = await requireApiUser();
    const body = await req.json();
    const input = createUserSchema.parse(body);
    const user = await createUser(actor, input);
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
