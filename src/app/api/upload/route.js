import { NextResponse } from "next/server";

import { handleApiError, requireApiUser } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { cloudinaryConfigured, uploadBuffer } from "@/lib/cloudinary";
import { kindFromMime } from "@/lib/attachment";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export async function POST(req) {
  try {
    await requireApiUser();
    if (!cloudinaryConfigured) {
      throw new AppError(
        "File uploads aren't configured yet. Add your Cloudinary keys.",
        503
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AppError("No file provided.", 400);
    }
    if (file.size > MAX_BYTES) {
      throw new AppError("File must be under 25 MB.", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const res = await uploadBuffer(buffer);

    return NextResponse.json({
      url: res.secure_url,
      publicId: res.public_id,
      resourceType: res.resource_type,
      format: res.format ?? "",
      bytes: res.bytes ?? file.size,
      name: file.name || "file",
      kind: kindFromMime(file.type),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
