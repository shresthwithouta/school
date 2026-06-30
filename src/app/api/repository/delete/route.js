import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { repoDeleteSchema } from "@/lib/validation";
import { deleteRepositoryFiles } from "@/lib/repository";

// Bulk permanent delete (also removes the Cloudinary assets). POST so the list
// of ids travels in the body.
export async function POST(req) {
  try {
    const actor = await requireApiUser();
    const { ids } = repoDeleteSchema.parse(await req.json());
    const result = await deleteRepositoryFiles(actor, ids);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
