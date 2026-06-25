/**
 * Ensure the database has the demo accounts and print the login credentials.
 * The app also auto-seeds when the users collection is empty, so this is
 * optional. Run with:  npm run seed
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { DEMO_ACCOUNTS as DEMO } from "../src/lib/demo.js";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Missing MONGODB_URI. Add it to .env.local.");
  process.exit(1);
}

const User =
  mongoose.models.User ||
  mongoose.model("User", new mongoose.Schema({}, { strict: false, collection: "users" }));

async function main() {
  await mongoose.connect(uri);
  const count = await User.estimatedDocumentCount();
  if (count === 0) {
    const now = new Date().toISOString();
    await User.insertMany(
      DEMO.map((a, i) => ({
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
    console.log(`✓ Seeded ${DEMO.length} accounts.`);
  } else {
    console.log(`ℹ ${count} account(s) already in the database.`);
  }
  console.log("\nLogins:");
  for (const a of DEMO) {
    console.log(`  ${a.role.padEnd(24)} ${a.email} / ${a.password}`);
  }
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
