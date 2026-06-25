import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { updateUserSchema } from "@/lib/validation";
import { deleteUser, updateUser } from "@/lib/users";

export async function PATCH(
  req,
  { params }
) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const body = await req.json();
    const input = updateUserSchema.parse(body);
    const user = await updateUser(actor, id, input);
    return NextResponse.json({ user });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req,
  { params }
) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    await deleteUser(actor, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
