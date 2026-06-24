/**
 * Ensure the database has the demo accounts and print the login credentials.
 * The store auto-seeds when the users collection is empty, so this is optional.
 *
 * Run with:  npm run seed
 */
import mongoose from "mongoose";
import { store } from "@/lib/store";
import { DEMO_ACCOUNTS } from "@/lib/demo";

async function main() {
  const users = await store.list(); // triggers auto-seed if empty
  console.log(`✓ Connected — ${users.length} account(s) in the database.`);
  console.log("\nDemo logins:");
  for (const a of DEMO_ACCOUNTS) {
    console.log(`  ${a.tierLabel.padEnd(6)}  ${a.email}  /  ${a.password}`);
  }
  console.log("\nChange these from Profile → Security after signing in.");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
