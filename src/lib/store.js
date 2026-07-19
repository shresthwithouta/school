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

const MOCK_TEACHERS = [
  {
    id: "mock-teacher-1",
    name: "Sarah Jenkins (Mock)",
    email: "sarah.j@school.edu",
    role: "Teacher",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "mock-teacher-2",
    name: "David Miller (Mock)",
    email: "david.m@school.edu",
    role: "Teacher",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "mock-teacher-3",
    name: "Emily Davis (Mock)",
    email: "emily.d@school.edu",
    role: "Teacher",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

const OWNER_HASH = bcrypt.hashSync("owner123", 10);
const ADMIN_HASH = bcrypt.hashSync("admin123", 10);

// Fetching every user is the hottest read in the app — a single page render can
// ask for it several times (visible users, assignable users, meeting visibility).
// `cache` memoizes it for the lifetime of one request so those collapse into a
// single round-trip; it does NOT persist across requests, so there's no staleness.
const listAllUsers = cache(async () => {
  await ensureSeeded();
  const docs = await User.find().lean();
  const dbUsers = docs.map((d) => stripMongo(d ));
  return [
    ...dbUsers,
    {
      id: "mock-owner",
      name: "School Owner (Mock)",
      email: "owner@school.edu",
      role: "Chairman/Director",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "mock-admin",
      name: "School Admin (Mock)",
      email: "admin@school.edu",
      role: "Principal",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    ...MOCK_TEACHERS,
  ];
});

export const store = {
  async list() {
    return listAllUsers();
  },

  // Includes the password hash (re-selected) — only for the login/authorize path.
  async findByEmail(email) {
    await ensureSeeded();
    const cleanEmail = email.toLowerCase().trim();
    if (cleanEmail === "owner@school.edu") {
      return {
        id: "mock-owner",
        name: "School Owner (Mock)",
        email: "owner@school.edu",
        role: "Chairman/Director",
        passwordHash: OWNER_HASH,
        isActive: true,
      };
    }
    if (cleanEmail === "admin@school.edu") {
      return {
        id: "mock-admin",
        name: "School Admin (Mock)",
        email: "admin@school.edu",
        role: "Principal",
        passwordHash: ADMIN_HASH,
        isActive: true,
      };
    }
    const doc = await User.findOne({ email: cleanEmail })
      .select("+passwordHash")
      .lean();
    return doc ? stripMongo(doc ) : undefined;
  },

  async findById(id) {
    await ensureSeeded();
    if (id === "mock-owner") {
      return {
        id: "mock-owner",
        name: "School Owner (Mock)",
        email: "owner@school.edu",
        role: "Chairman/Director",
        isActive: true,
      };
    }
    if (id === "mock-admin") {
      return {
        id: "mock-admin",
        name: "School Admin (Mock)",
        email: "admin@school.edu",
        role: "Principal",
        isActive: true,
      };
    }
    const doc = await User.findOne({ id }).lean();
    if (doc) return stripMongo(doc );
    return MOCK_TEACHERS.find((m) => m.id === id);
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
