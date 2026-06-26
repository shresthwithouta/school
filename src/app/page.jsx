import Link from "next/link";
import {
  GraduationCap,
  ArrowRight,
  ClipboardList,
  CalendarCheck,
  CalendarDays,
  BarChart3,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata = {
  title: "School Workforce Management",
  description:
    "One workspace for your school's staff — tasks, meetings, calendar and performance, organised by role.",
};

const PILLS = [
  { icon: ClipboardList, label: "Tasks" },
  { icon: CalendarCheck, label: "Meetings" },
  { icon: CalendarDays, label: "Calendar" },
  { icon: BarChart3, label: "Reports" },
];

export default function Landing() {
  const year = new Date().getFullYear();

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
      {/* Decorative background */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 -top-72 -z-10 h-168 w-240 -translate-x-1/2 rounded-full opacity-70 blur-3xl [background:radial-gradient(circle_at_center,color-mix(in_oklch,var(--primary),transparent_55%),transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(color-mix(in_oklch,var(--primary),transparent_88%)_1px,transparent_1px)] bg-size-[26px_26px] mask-[radial-gradient(ellipse_60%_55%_at_50%_35%,black,transparent_80%)]"
      />

      {/* Top bar */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/30">
            <GraduationCap className="size-5" />
          </div>
          <span className="text-base font-semibold tracking-tight">SWM</span>
        </div>
        <Button asChild variant="ghost" className="h-9 rounded-lg px-4">
          <Link href="/login">Sign in</Link>
        </Button>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 text-center">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
          <span className="size-1.5 rounded-full bg-primary" />
          School Workforce Management
        </span>

        <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Your school&apos;s operations,
          <br />
          <span className="bg-linear-to-r from-indigo-600 via-indigo-500 to-violet-500 bg-clip-text text-transparent">
            all in one place.
          </span>
        </h1>

        <p className="mt-6 max-w-md text-pretty text-base text-muted-foreground sm:text-lg">
          Tasks, meetings and reports — organised by role, for every member of
          staff.
        </p>

        <div className="mt-9 flex items-center justify-center">
          <Button
            asChild
            size="lg"
            className="group h-11 rounded-xl px-6 text-[0.95rem]"
          >
            <Link href="/login">
              Sign in
              <ArrowRight className="size-4 transition-transform group-hover/button:translate-x-0.5" />
            </Link>
          </Button>
        </div>

        <p className="mt-5 text-xs text-muted-foreground">
          Staff access only · accounts are issued by your administrator.
        </p>

        {/* Feature pills */}
        <ul className="mt-14 flex flex-wrap items-center justify-center gap-2.5">
          {PILLS.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-4 py-2 text-sm font-medium text-foreground/80 backdrop-blur"
            >
              <Icon className="size-4 text-primary" />
              {label}
            </li>
          ))}
        </ul>
      </section>

      {/* Footer */}
      <footer className="relative z-10 mx-auto w-full max-w-6xl px-6 py-6 text-center text-xs text-muted-foreground">
        © {year} SWM · Private staff tool
      </footer>
    </main>
  );
}
