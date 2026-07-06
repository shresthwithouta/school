

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
  // Sessions persist for 30 days and roll forward on activity (re-issued once
  // a day at most), so staying logged in doesn't require reauthenticating every
  // few hours — important for the installed PWA/TWA, which has no separate
  // "remember me" flow. The jwt callback still re-syncs role/active status
  // every few minutes so a demotion/deactivation takes effect mid-session.
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
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
