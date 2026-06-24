import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Next.js 16 "proxy" (formerly "middleware"). Edge-safe: only the
// cookie-verifying config is used here — no Mongoose in the Edge bundle.
export default NextAuth(authConfig).auth;

export const config = {
  // Run on everything except Next internals, the auth API, and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
