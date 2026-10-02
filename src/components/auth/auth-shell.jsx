import { GraduationCap } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";

/** Centered single-column layout for the public password-recovery pages. */
export function AuthShell({ title, description, children }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex items-center gap-3">
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
            <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
