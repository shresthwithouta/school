/**
 * Demo accounts seeded on first run. Plain data only (no Node APIs) so this is
 * safe to import in client components for the one-click login buttons.
 */
export const DEMO_ACCOUNTS = [
  {
    name: "School Owner",
    email: "owner@school.edu",
    password: "owner123",
    role: "Chairman/Director",
    department: "Management",
    tierLabel: "Owner",
  },
  {
    name: "Priya Principal",
    email: "admin@school.edu",
    password: "admin123",
    role: "Principal",
    department: "Administration",
    tierLabel: "Admin",
  },
  {
    name: "Tina Teacher",
    email: "worker@school.edu",
    password: "worker123",
    role: "Teacher",
    department: "Science",
    tierLabel: "Worker",
  },
] ;
