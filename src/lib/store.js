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

 
















let seeded = false;

async function ensureSeeded() {
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
  async list() {
    await ensureSeeded();
    const docs = await User.find().lean();
    return docs.map((d) => stripMongo(d ));
  },

  async findByEmail(email) {
    await ensureSeeded();
    const doc = await User.findOne({ email: email.toLowerCase().trim() }).lean();
    return doc ? stripMongo(doc ) : undefined;
  },

  async findById(id) {
    await ensureSeeded();
    const doc = await User.findOne({ id }).lean();
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
