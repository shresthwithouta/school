import crypto from "crypto";

import { connectToDatabase, stripMongo } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { isOwner } from "@/lib/rbac";
import { copyAsset, destroyAsset } from "@/lib/cloudinary";
import RepoFile from "@/models/RepoFile";

// The file Repository is the Admin's (Owner tier) private store. Only an Admin
// can save, share and delete files; everyone else sees only the files an
// Admin has shared with them.

function now() {
  return new Date().toISOString();
}

/** Throws unless the actor has the Admin role (Owner tier). */
function requireAdmin(actor) {
  if (!isOwner(actor.role)) {
    throw new AppError("Only an Admin can manage the file repository.", 403);
  }
}

/**
 * Files this actor may see: an Admin sees everything; everyone else sees
 * only files shared with them. Newest first.
 */
export async function listRepositoryFiles(actor) {
  await connectToDatabase();
  const filter = isOwner(actor.role) ? {} : { sharedWith: actor.id };
  const docs = await RepoFile.find(filter).lean();
  return docs
    .map((d) => stripMongo(d))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/**
 * Save a file into the repository (Admin only). The Cloudinary asset is
 * copied so the saved file is independent of the task/meeting it came from
 * (deleting that later won't break this). Falls back to referencing the
 * original asset when Cloudinary isn't configured.
 */
export async function saveToRepository(actor, input) {
  requireAdmin(actor);
  await connectToDatabase();

  let asset = null;
  try {
    asset = await copyAsset(input.url, input.resourceType);
  } catch (err) {
    console.error("Repository copy failed, referencing original:", err?.message || err);
  }

  const ts = now();
  const file = {
    id: crypto.randomUUID(),
    url: asset?.url ?? input.url,
    publicId: asset?.publicId ?? input.publicId,
    resourceType: asset?.resourceType ?? input.resourceType,
    format: asset?.format ?? input.format ?? "",
    bytes: asset?.bytes ?? input.bytes ?? 0,
    name: input.name,
    kind: input.kind,
    sourceType: input.sourceType ?? "",
    sourceId: input.sourceId ?? "",
    sourceTitle: input.sourceTitle ?? "",
    savedById: actor.id,
    savedByName: actor.name,
    sharedWith: [],
    createdAt: ts,
    updatedAt: ts,
  };
  await RepoFile.create(file);
  return stripMongo(file);
}

/** Replace a repository file's share list (Admin only). */
export async function shareRepositoryFile(actor, id, userIds) {
  requireAdmin(actor);
  await connectToDatabase();
  const doc = await RepoFile.findOne({ id }).lean();
  if (!doc) throw new AppError("File not found.", 404);
  const sharedWith = [...new Set(userIds)];
  await RepoFile.updateOne({ id }, { $set: { sharedWith, updatedAt: now() } });
  return { ...stripMongo(doc), sharedWith };
}

/**
 * Permanently delete repository files (Admin only) — removes the records and
 * destroys their Cloudinary assets.
 */
export async function deleteRepositoryFiles(actor, ids) {
  requireAdmin(actor);
  await connectToDatabase();
  const docs = await RepoFile.find({ id: { $in: ids } }).lean();
  if (docs.length === 0) return { deleted: 0 };
  await RepoFile.deleteMany({ id: { $in: docs.map((d) => d.id) } });
  await Promise.allSettled(
    docs
      .filter((d) => d.publicId)
      .map((d) => destroyAsset(d.publicId, d.resourceType))
  );
  return { deleted: docs.length };
}
