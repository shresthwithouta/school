/**
 * Demo accounts seeded on first run. Plain data only (no Node APIs) so this is
 * safe to import in client components for the one-click login buttons.
 */
export const DEMO_ACCOUNTS = [
  {
    name: "School Admin",
    email: "owner@school.edu",
    password: "owner123",
    role: "Admin",
    department: "Management",
    tierLabel: "Owner tier",
  },
  {
    name: "Manoj Manager",
    email: "admin@school.edu",
    password: "admin123",
    role: "Manager",
    department: "Administration",
    tierLabel: "Admin tier",
  },
  {
    name: "Tina Teacher",
    email: "worker@school.edu",
    password: "worker123",
    role: "Teacher",
    department: "Science",
    tierLabel: "Worker tier",
  },
] ;
