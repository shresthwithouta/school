import { v2 as cloudinary } from "cloudinary";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

export const cloudinaryConfigured = Boolean(cloudName && apiKey && apiSecret);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
}

 







export function uploadBuffer(
  buffer,
  folder = "swm"
) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "auto" },
      (err, res) => {
        if (err || !res) return reject(err ?? new Error("Upload failed"));
        resolve(res );
      }
    );
    stream.end(buffer);
  });
}

/**
 * Copy an already-uploaded Cloudinary asset into a fresh, independent asset
 * (used when the Chairman saves a task/meeting file into the Repository, so
 * deleting the original later never breaks the saved copy). Cloudinary fetches
 * the source URL server-side. Returns the new asset's metadata, or null when
 * Cloudinary isn't configured (caller falls back to referencing the original).
 */
export async function copyAsset(url, resourceType) {
  if (!cloudinaryConfigured) return null;
  const res = await cloudinary.uploader.upload(url, {
    folder: "swm/repository",
    resource_type: resourceType || "auto",
  });
  return {
    url: res.secure_url,
    publicId: res.public_id,
    resourceType: res.resource_type,
    format: res.format ?? "",
    bytes: res.bytes ?? 0,
  };
}

export async function destroyAsset(publicId, resourceType) {
  if (!cloudinaryConfigured) return;
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType || "image",
    });
  } catch (err) {
    console.error("Cloudinary destroy failed:", err);
  }
}
