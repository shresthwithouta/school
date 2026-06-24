import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { updateProfileSchema } from "@/lib/validation";
import { updateOwnProfile } from "@/lib/users";

export async function PATCH(req: Request) {
  try {
    const actor = await requireApiUser();
    const body = await req.json();
    const input = updateProfileSchema.parse(body);
    const user = await updateOwnProfile(actor.id, input);
    return NextResponse.json({ user });
  } catch (err) {
    return handleApiError(err);
  }
}
