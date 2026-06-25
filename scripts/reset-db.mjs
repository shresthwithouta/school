/**
 * Wipe the database and seed exactly one account per role.
 * Run with:  npm run reset-db
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { DEMO_ACCOUNTS } from "../src/lib/demo.js";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Missing MONGODB_URI. Add it to .env.local.");
  process.exit(1);
}

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection;

  for (const c of ["tasks", "meetings", "users"]) {
    const res = await db.collection(c).deleteMany({});
    console.log(`✓ Cleared "${c}" (${res.deletedCount})`);
  }

  const now = new Date().toISOString();
  const docs = DEMO_ACCOUNTS.map((a, i) => ({
    id: `user-${i + 1}`,
    name: a.name,
    email: a.email,
    passwordHash: bcrypt.hashSync(a.password, 10),
    role: a.role,
    department: a.department || "",
    phone: "",
    avatarUrl: "",
    bio: "",
    isActive: true,
    mustChangePassword: false,
    createdBy: null,
    lastLoginAt: null,
    createdAt: now,
  }));
  await db.collection("users").insertMany(docs);

  console.log(`\n✓ Seeded ${docs.length} accounts (one per role):\n`);
  for (const a of DEMO_ACCOUNTS) {
    console.log(`  ${a.role.padEnd(24)} ${a.email.padEnd(24)} ${a.password}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
