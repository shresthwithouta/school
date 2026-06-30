import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { repoShareSchema } from "@/lib/validation";
import { shareRepositoryFile } from "@/lib/repository";

export async function PATCH(req, { params }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const { userIds } = repoShareSchema.parse(await req.json());
    const file = await shareRepositoryFile(actor, id, userIds);
    return NextResponse.json({ file });
  } catch (err) {
    return handleApiError(err);
  }
}
