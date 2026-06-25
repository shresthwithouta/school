export type AttachmentKind = "image" | "audio" | "video" | "file";

export type Attachment = {
  id: string;
  url: string;
  publicId: string;
  resourceType: string;
  format: string;
  bytes: number;
  name: string;
  kind: AttachmentKind;
  uploadedById: string;
  uploadedByName: string;
  createdAt: string;
};

/** What the /api/upload route returns (before the server stamps id/uploader). */
export type UploadedAttachment = Omit<
  Attachment,
  "id" | "uploadedById" | "uploadedByName" | "createdAt"
>;

export function formatBytes(n: number): string {
  if (!n) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(k)));
  return `${(n / Math.pow(k, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
}

export function kindFromMime(mime: string): AttachmentKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "file";
}
