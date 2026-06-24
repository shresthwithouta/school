import crypto from "crypto";
import bcrypt from "bcryptjs";

import { connectToDatabase, stripMongo } from "@/lib/db";
import User from "@/models/User";
import { DEMO_ACCOUNTS } from "@/lib/demo";

/**
 * User repository backed by MongoDB. The app uses a string `id` field; Mongo's
 * `_id` is stripped before anything leaves this layer. Demo accounts are seeded
 * once when the collection is empty so login works immediately.
 */

export type StoredUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  department: string;
  phone: string;
  avatarUrl: string;
  bio: string;
  isActive: boolean;
  mustChangePassword: boolean;
  createdBy: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

let seeded = false;

async function ensureSeeded(): Promise<void> {
  await connectToDatabase();
  if (seeded) return;
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

export const store = {
  async list(): Promise<StoredUser[]> {
    await ensureSeeded();
    const docs = await User.find().lean();
    return docs.map((d) => stripMongo<StoredUser>(d as Record<string, unknown>));
  },

  async findByEmail(email: string): Promise<StoredUser | undefined> {
    await ensureSeeded();
    const doc = await User.findOne({ email: email.toLowerCase().trim() }).lean();
    return doc ? stripMongo<StoredUser>(doc as Record<string, unknown>) : undefined;
  },

  async findById(id: string): Promise<StoredUser | undefined> {
    await ensureSeeded();
    const doc = await User.findOne({ id }).lean();
    return doc ? stripMongo<StoredUser>(doc as Record<string, unknown>) : undefined;
  },

  async create(
    data: Omit<StoredUser, "id" | "createdAt" | "lastLoginAt">
  ): Promise<StoredUser> {
    await connectToDatabase();
    const user: StoredUser = {
      ...data,
      id: crypto.randomUUID(),
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
    };
    await User.create(user);
    return user;
  },

  async update(
    id: string,
    patch: Partial<StoredUser>
  ): Promise<StoredUser | undefined> {
    await connectToDatabase();
    const doc = await User.findOneAndUpdate(
      { id },
      { $set: patch },
      { returnDocument: "after" }
    ).lean();
    return doc ? stripMongo<StoredUser>(doc as Record<string, unknown>) : undefined;
  },

  async remove(id: string): Promise<boolean> {
    await connectToDatabase();
    const res = await User.deleteOne({ id });
    return res.deletedCount > 0;
  },
};
