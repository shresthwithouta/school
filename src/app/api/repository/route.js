import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { repoSaveSchema } from "@/lib/validation";
import { listRepositoryFiles, saveToRepository } from "@/lib/repository";

export async function GET() {
  try {
    const actor = await requireApiUser();
    const files = await listRepositoryFiles(actor);
    return NextResponse.json({ files });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req) {
  try {
    const actor = await requireApiUser();
    const input = repoSaveSchema.parse(await req.json());
    const file = await saveToRepository(actor, input);
    return NextResponse.json({ file }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
