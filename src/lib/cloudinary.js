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
