
import { redirect } from "next/navigation";
import {
  GraduationCap,
  CalendarCheck,
  ClipboardList,
  ShieldCheck,
  BarChart3,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = {
  title: "Sign in",
};

const HIGHLIGHTS = [
  {
    icon: ClipboardList,
    title: "Task workflows",
    desc: "Assign, track, review and approve work end to end.",
  },
  {
    icon: CalendarCheck,
    title: "Meetings & events",
    desc: "Schedule, record minutes and coordinate event teams.",
  },
  {
    icon: BarChart3,
    title: "Performance insight",
    desc: "Timeliness, quality and accuracy at a glance.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    desc: "Everyone sees exactly what their role allows.",
  },
];

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand / marketing panel */}
      <div className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(60rem_60rem_at_120%_-10%,white,transparent_55%)]"
        />
        <div className="relative flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <GraduationCap className="size-6" />
          </div>
          <div className="leading-tight">
            <p className="text-lg font-semibold tracking-tight">SWM Platform</p>
            <p className="text-sm text-primary-foreground/70">
              School Workforce Management
            </p>
          </div>
        </div>

        <div className="relative max-w-md space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight">
              Run your school&apos;s operations with clarity and accountability.
            </h1>
            <p className="text-primary-foreground/80">
              One platform for tasks, meetings, events and performance — across
              every role, from the Chairman to every team member.
            </p>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {HIGHLIGHTS.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex gap-3">
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
                  <Icon className="size-4.5" />
                </div>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-sm text-primary-foreground/70">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-primary-foreground/60">
          © {new Date().getFullYear()} SWM Platform. All rights reserved.
        </p>
      </div>

      {/* Login form panel */}
      <div className="relative flex flex-col">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-sm space-y-8">
            {/* Compact brand for mobile */}
            <div className="flex items-center gap-3 lg:hidden">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <GraduationCap className="size-5" />
              </div>
              <div className="leading-tight">
                <p className="font-semibold tracking-tight">SWM Platform</p>
                <p className="text-xs text-muted-foreground">
                  School Workforce Management
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl font-semibold tracking-tight">
                Welcome back
              </h2>
              <p className="text-sm text-muted-foreground">
                Sign in with the credentials provided by your administrator.
              </p>
            </div>

            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
