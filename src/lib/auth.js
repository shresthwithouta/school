import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { authConfig } from "@/lib/auth.config";
import { getTier } from "@/lib/rbac";
import { store } from "@/lib/store";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// How often the JWT re-checks the user's role/active flag against the DB.
const ROLE_REFRESH_MS = 5 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await store.findByEmail(email);
        if (!user || !user.isActive || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        await store.update(user.id, { lastLoginAt: new Date().toISOString() });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          image: user.avatarUrl || null,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user ).role;
        token.refreshAt = Date.now() + ROLE_REFRESH_MS;
        return token;
      }
      // Periodically re-sync role/active status from the DB so a demotion or
      // deactivation takes effect mid-session instead of lingering until the
      // token expires. Returning null clears the session (forces sign-out).
      if (token.id && (!token.refreshAt || Date.now() > token.refreshAt)) {
        try {
          const fresh = await store.findById(token.id );
          if (!fresh || !fresh.isActive) return null;
          token.role = fresh.role;
          token.name = fresh.name;
          token.refreshAt = Date.now() + ROLE_REFRESH_MS;
        } catch {
          // DB hiccup — keep the existing token and retry on the next request.
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id ) ?? "";
        session.user.role = (token.role ) ?? "";
        session.user.tier = getTier(token.role );
      }
      return session;
    },
  },
});
