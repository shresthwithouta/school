

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
  session: { strategy: "jwt" },
  callbacks: {
    // Runs in middleware for every matched request.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const onLogin = nextUrl.pathname === "/login";

      if (onLogin) {
        // Already signed in? Skip the login screen.
        if (isLoggedIn) return Response.redirect(new URL("/dashboard", nextUrl));
        return true;
      }

      // Everything else requires authentication.
      return isLoggedIn;
    },
  },
  providers: [],
} ;
