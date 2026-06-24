import { redirect } from "next/navigation";

export default function Home() {
  // Auth gate lives in middleware: unauthenticated users are sent to /login.
  redirect("/dashboard");
}
