"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function SessionNotice() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <h3 className="text-lg font-semibold">Your session is out of date</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your account couldn&apos;t be found — this usually means the data was
          refreshed. Please sign in again to continue.
        </p>
        <Button onClick={() => signOut({ redirectTo: "/login" })}>
          <LogOut className="size-4" />
          Sign in again
        </Button>
      </CardContent>
    </Card>
  );
}
