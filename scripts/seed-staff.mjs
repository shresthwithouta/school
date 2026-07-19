/**
 * Seed real staff accounts (from the onboarding Google Form export) into the
 * users collection. Idempotent: skips anyone whose email already exists.
 *
 *   npm run seed:staff
 *
 * Each account's temporary password defaults to the member's own email
 * address (matches createUser in lib/users.js), with mustChangePassword=true
 * so they're nudged to pick their own after signing in.
 */
import mongoose from "mongoose";
import dns from "dns";
import crypto from "crypto";
import bcrypt from "bcryptjs";

// Maps the free-text "Designation" from the form to a canonical app role
// (see src/lib/rbac.js ROLES).
const ROLE_MAP = {
  Teacher: "Teacher",
  "Office Staff": "Staff",
  Other: "Staff",
  Director: "Admin", // Owner tier — sees & manages everyone
  Principal: "Manager",
};

// Fallback department when the person gave no subject/specialty.
const DEPT_DEFAULT = {
  Admin: "Management",
  Manager: "Administration",
  Staff: "Office",
  Teacher: "",
};

// Roster: name, login email (the "Email ID" column), designation, subjects, notes.
const STAFF = [
  { name: "SATYA PRAKASH KUMAR", email: "sksatyaprakash@gmail.com", desig: "Teacher", subjects: "Science", info: "" },
  { name: "Isha Kumari", email: "Ishas9301@gmail.com", desig: "Teacher", subjects: "Mathematics, Computer", info: "" },
  { name: "Madhav Kumar", email: "madhavrajput585@gmail.com", desig: "Teacher", subjects: "NA", info: "" },
  { name: "R K Jha", email: "vimalrk738@gmail.com", desig: "Teacher", subjects: "Physics", info: "Team work should be enforced" },
  { name: "RAJEEV KAMAL SINHA", email: "manager.mkhs@gmail.com", desig: "Office Staff", subjects: "NA", info: "" },
  { name: "Sweta Kumari", email: "swetabharti5929@gmail.com", desig: "Teacher", subjects: "Social science", info: "" },
  { name: "Neha Rani", email: "nehum38@gmail.com", desig: "Teacher", subjects: "Hindi and Sanskrit", info: "" },
  { name: "Utsav raj", email: "utsavraj029@gmail.com", desig: "Teacher", subjects: "Chemistry and maths", info: "Chemistry in class 9,10&11....and maths in class 5,6&8" },
  { name: "Guddu kumar", email: "sahgudd321@gmail.com", desig: "Teacher", subjects: "Mathematics", info: "" },
  { name: "RINKI KUMARI", email: "adarsh1177singh@gmail.com", desig: "Teacher", subjects: "All subject", info: "PRT" },
  { name: "Arushi Kumari", email: "arushik387@gmail.com", desig: "Teacher", subjects: "Drawing, and Dance", info: "" },
  { name: "Shailesh Kumar", email: "shaileshrani2101@gmail.com", desig: "Office Staff", subjects: "NA", info: "" },
  { name: "Ruhi kumari", email: "ruhikumaribju7677@gmail.com", desig: "Office Staff", subjects: "NA", info: "" },
  { name: "Urwashi kumari", email: "urwashikumaribgs0007@gmail.com", desig: "Teacher", subjects: "Na", info: "Na" },
  { name: "Shagufa khatoon", email: "shagufakhatoon67@gmail.com", desig: "Teacher", subjects: "Na", info: "Na" },
  { name: "Muskan Kumari", email: "pankajkumaramarpur9@gmail.com", desig: "Teacher", subjects: "English", info: "" },
  { name: "Arpit Mishra", email: "avoidthem2023@gmail.com", desig: "Office Staff", subjects: "NA", info: "NA" },
  { name: "Shashikesh kumar", email: "kumarshashikesh493@gmail.com", desig: "Teacher", subjects: "Social Studies and General Knowledge", info: "" },
  { name: "KRISHNA KUMAR", email: "krishan6301@gmail.com", desig: "Teacher", subjects: "SCIENCE", info: "" },
  { name: "MANISH KUMAR", email: "mnshkmr703@gmail.com", desig: "Other", subjects: "na", info: "na" },
  { name: "Raghavendra Pratap Arya", email: "rparya1975@gmail.com", desig: "Teacher", subjects: "English.", info: "na" },
  { name: "Yashwant Kumar", email: "yashwantb4ubarauni81@gmail.com", desig: "Director", subjects: "N/A", info: "N/A" },
  { name: "Gaurav Mishra", email: "mishragaurav327@gmail.com", desig: "Teacher", subjects: "Social studies", info: "" },
  { name: "Minakshi Bharti", email: "anushkaenterprises.bju@gmail.com", desig: "Principal", subjects: "NA", info: "NA" },
];

// Treat "NA" / "N/A" / "na" / "Na" / blank as no value.
const clean = (v) => {
  const t = (v || "").trim();
  if (!t || /^n\.?\s*\/?\s*a\.?$/i.test(t)) return "";
  return t;
};

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Missing MONGODB_URI. Add it to .env.local.");
  process.exit(1);
}

// Match src/lib/db.js: route SRV lookups through public resolvers when local
// ones refuse them.
if (uri.startsWith("mongodb+srv")) {
  try {
    dns.setServers([...new Set(["8.8.8.8", "1.1.1.1", ...dns.getServers()])]);
  } catch {
    // ignore — fall back to system resolver
  }
}

// Define `id` explicitly (mirrors src/models/User.js). An empty strict:false
// schema would leave `id` as Mongoose's default virtual (aliased to _id), so it
// never persists and every insert collides on the unique id index as null.
const UserSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: String,
    email: { type: String, lowercase: true },
    passwordHash: String,
    role: String,
    department: String,
    phone: String,
    avatarUrl: String,
    bio: String,
    isActive: Boolean,
    mustChangePassword: Boolean,
    createdBy: { type: String, default: null },
    lastLoginAt: { type: String, default: null },
    createdAt: String,
  },
  { collection: "users", versionKey: false }
);

const User = mongoose.models.User || mongoose.model("User", UserSchema);

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });

  const created = [];
  const skipped = [];

  for (const s of STAFF) {
    const email = s.email.toLowerCase().trim();
    const role = ROLE_MAP[s.desig];
    if (!role) {
      console.error(`! Unknown designation "${s.desig}" for ${s.name} — skipped.`);
      continue;
    }

    const existing = await User.findOne({ email }).lean();
    if (existing) {
      skipped.push({ name: s.name, email, why: "email already exists" });
      continue;
    }

    const department = clean(s.subjects) || DEPT_DEFAULT[role] || "";
    const bio = clean(s.info);
    const now = new Date().toISOString();
    const passwordHash = bcrypt.hashSync(email, 10);

    await User.create({
      id: crypto.randomUUID(),
      name: s.name.trim(),
      email,
      passwordHash,
      role,
      department,
      phone: "",
      avatarUrl: "",
      bio,
      isActive: true,
      mustChangePassword: true,
      createdBy: null,
      lastLoginAt: null,
      createdAt: now,
    });
    created.push({ name: s.name.trim(), email, role, department });
  }

  console.log(`\n✓ Created ${created.length} account(s); skipped ${skipped.length}.`);
  if (created.length) {
    console.log("\nEach account's temporary password is their own email address.");
    console.log("(mustChangePassword is set — ask each person to change it in Settings.)\n");
    console.log("Created accounts:");
    for (const c of created) {
      console.log(`  ${c.role.padEnd(18)} ${c.email.padEnd(36)} ${c.name}${c.department ? "  ·  " + c.department : ""}`);
    }
  }
  if (skipped.length) {
    console.log("\nSkipped:");
    for (const s of skipped) console.log(`  ${s.email.padEnd(36)} (${s.why})`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
