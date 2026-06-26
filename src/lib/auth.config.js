

/**
 * Edge-safe Auth.js configuration.
 *
 * This file must NOT import Mongoose, bcrypt, or any Node-only code, because it
 * is consumed by the Edge middleware. The heavy Credentials provider lives in
 * `auth.ts` (Node runtime) instead. Middleware only needs to verify the signed
 * session cookie, which works fine with an empty providers list.
 */
export const authConfig = {
  // Trust the deployment host (Vercel sets a dynamic domain). Avoids
  // "UntrustedHost" errors in production.
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  // Cap session lifetime to 8 hours (a working day). The jwt callback also
  // re-syncs role/active status every few minutes for mid-session changes.
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  callbacks: {
    // Runs in middleware for every matched request.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;
      // Public, unauthenticated pages: the marketing landing page and login.
      const isPublic = pathname === "/" || pathname === "/login";

      if (isPublic) {
        // Signed-in staff skip the landing/login and go straight to the app.
        if (isLoggedIn) return Response.redirect(new URL("/dashboard", nextUrl));
        return true;
      }

      // Everything else requires authentication.
      return isLoggedIn;
    },
  },
  providers: [],
} ;
