/**
 * Seed accounts — one per role. Plain data only (no Node APIs) so it's safe to
 * import anywhere. Used by the store's first-run seed and by the reset script.
 * All share the password below for easy demoing.
 */
export const DEMO_PASSWORD = "password123";

export const DEMO_ACCOUNTS = [
  { name: "Rajesh Khanna", email: "chairman@school.edu", role: "Chairman/Director", department: "Management", password: DEMO_PASSWORD },
  { name: "Meera Iyer", email: "principal@school.edu", role: "Principal", department: "Administration", password: DEMO_PASSWORD },
  { name: "Anil Verma", email: "academic@school.edu", role: "Academic Coordinator", department: "Academics", password: DEMO_PASSWORD },
  { name: "Sunita Rao", email: "manager@school.edu", role: "Administrative Manager", department: "Operations", password: DEMO_PASSWORD },
  { name: "Vikram Sethi", email: "events@school.edu", role: "Event Coordinator", department: "Events", password: DEMO_PASSWORD },
  { name: "Deepa Nair", email: "accountant@school.edu", role: "Accountant", department: "Finance", password: DEMO_PASSWORD },
  { name: "Arjun Mehta", email: "teacher@school.edu", role: "Teacher", department: "Science", password: DEMO_PASSWORD },
  { name: "Kavya Reddy", email: "classteacher@school.edu", role: "Class Teacher", department: "Grade 5", password: DEMO_PASSWORD },
  { name: "Rohan Das", email: "teammember@school.edu", role: "Team Member", department: "Events", password: DEMO_PASSWORD },
];
