import crypto from "crypto";
import { cache } from "react";
import bcrypt from "bcryptjs";

import { connectToDatabase, stripMongo } from "@/lib/db";
import User from "@/models/User";
import { DEMO_ACCOUNTS } from "@/lib/demo";

/**
 * User repository backed by MongoDB. The app uses a string `id` field; Mongo's
 * `_id` is stripped before anything leaves this layer. Demo accounts are seeded
 * once when the collection is empty so login works immediately.
 */

 
















let seeded = false;

// Seeding ships three accounts with publicly-known passwords (owner123, etc.).
// That's fine for local/demo use but a takeover risk in production, so only
// seed outside production unless explicitly opted in via SEED_DEMO=true.
const ALLOW_DEMO_SEED =
  process.env.NODE_ENV !== "production" || process.env.SEED_DEMO === "true";

async function ensureSeeded() {
  await connectToDatabase();
  if (seeded) return;
  if (!ALLOW_DEMO_SEED) {
    seeded = true;
    return;
  }
  const count = await User.estimatedDocumentCount();
  if (count === 0) {
    const now = new Date().toISOString();
    await User.insertMany(
      DEMO_ACCOUNTS.map((a, i) => ({
        id: `seed-${i + 1}`,
        name: a.name,
        email: a.email,
        passwordHash: bcrypt.hashSync(a.password, 10),
        role: a.role,
        department: a.department,
        phone: "",
        avatarUrl: "",
        bio: "",
        isActive: true,
        mustChangePassword: false,
        createdBy: null,
        lastLoginAt: null,
        createdAt: now,
      }))
    );
  }
  seeded = true;
}

// Fetching every user is the hottest read in the app — a single page render can
// ask for it several times (visible users, assignable users, meeting visibility).
// `cache` memoizes it for the lifetime of one request so those collapse into a
// single round-trip; it does NOT persist across requests, so there's no staleness.
const listAllUsers = cache(async () => {
  await ensureSeeded();
  const docs = await User.find().lean();
  return docs.map((d) => stripMongo(d ));
});

export const store = {
  async list() {
    return listAllUsers();
  },

  // Includes the password hash (re-selected) — only for the login/authorize path.
  async findByEmail(email) {
    await ensureSeeded();
    const doc = await User.findOne({ email: email.toLowerCase().trim() })
      .select("+passwordHash")
      .lean();
    return doc ? stripMongo(doc ) : undefined;
  },

  async findById(id) {
    await ensureSeeded();
    const doc = await User.findOne({ id }).lean();
    return doc ? stripMongo(doc ) : undefined;
  },

  // Like findById but re-selects the password hash — only for verifying the
  // current password during a self-service password change.
  async findByIdWithPassword(id) {
    await ensureSeeded();
    const doc = await User.findOne({ id }).select("+passwordHash").lean();
    return doc ? stripMongo(doc ) : undefined;
  },

  async create(
    data
  ) {
    await connectToDatabase();
    const user = {
      ...data,
      id: crypto.randomUUID(),
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
    };
    await User.create(user);
    return user;
  },

  async update(
    id,
    patch
  ) {
    await connectToDatabase();
    const doc = await User.findOneAndUpdate(
      { id },
      { $set: patch },
      { returnDocument: "after" }
    ).lean();
    return doc ? stripMongo(doc ) : undefined;
  },

  async remove(id) {
    await connectToDatabase();
    const res = await User.deleteOne({ id });
    return res.deletedCount > 0;
  },
};
