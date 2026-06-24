import type { DefaultSession } from "next-auth";
import type { Tier } from "@/lib/rbac";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      tier: Tier;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
  }
}
