import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/errors";
import { getCurrentUser, } from "@/lib/session";

/** Throws AppError(401) if there is no authenticated user. */
export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) throw new AppError("You must be signed in.", 401);
  return user;
}

/** Maps thrown errors to JSON responses with the right status code. */
export function handleApiError(err) {
  if (err instanceof AppError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const first = err.issues[0]?.message ?? "Validation failed.";
    return NextResponse.json({ error: first }, { status: 422 });
  }
  if (err instanceof SyntaxError) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  console.error("Unhandled API error:", err);
  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 }
  );
}
