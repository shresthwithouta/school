"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import { Sun, Moon, LogOut } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SettingsClient({ user }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // next-themes: only reflect the active theme after mount to avoid a
  // hydration mismatch (server doesn't know the client's theme).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  const current = mounted ? resolvedTheme || theme : "light";

  const options = [
    { key: "light", label: "Light", Icon: Sun },
    { key: "dark", label: "Dark", Icon: Moon },
  ];

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>How the app looks on this device.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          {options.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTheme(key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors",
                current === key
                  ? "border-primary bg-primary/5"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your signed-in account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Detail label="Name" value={user.name} />
            <Detail label="Email" value={user.email} />
            <Detail label="Role" value={user.role} />
          </div>
          <Button variant="outline" onClick={() => signOut({ redirectTo: "/login" })}>
            <LogOut className="size-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
