"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, Loader2, AlertTriangle } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import {
  VAPID_PUBLIC_KEY,
  pushSupported,
  readPermission,
  requestPermission,
  subscribeThisDevice,
  unsubscribeThisDevice,
  getExistingSubscription,
} from "@/lib/push-client";

export function PushNotifications() {
  // "checking" → "unsupported" (no SW/Push) | "unconfigured" (no VAPID key) | "ready"
  const [status, setStatus] = useState("checking");
  const [permission, setPermission] = useState("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      // Defer past the synchronous effect body so state is never set during render.
      await Promise.resolve();
      if (cancelled) return;
      if (!pushSupported()) {
        setStatus("unsupported");
        return;
      }
      if (!VAPID_PUBLIC_KEY) {
        setStatus("unconfigured");
        return;
      }
      setStatus("ready");
      setPermission(await readPermission());
      try {
        const sub = await getExistingSubscription();
        if (!cancelled) setSubscribed(!!sub);
      } catch {
        // No registration yet (e.g. first load) — leave as not subscribed.
      }
    }

    detect();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const perm = await requestPermission();
      setPermission(perm);
      if (perm === "denied") {
        toast.error("Notifications are blocked. Enable them in your app settings.");
        return;
      }
      await subscribeThisDevice({ welcome: true });
      setSubscribed(true);
      setPermission(await readPermission());
      toast.success("Notifications enabled");
    } catch (err) {
      toast.error(err?.message || "Could not enable notifications");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      await unsubscribeThisDevice();
      setSubscribed(false);
      toast.success("Notifications turned off");
    } catch (err) {
      toast.error(err?.message || "Could not turn off notifications");
    } finally {
      setBusy(false);
    }
  }

  if (status === "checking") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Checking notification support…
      </div>
    );
  }

  if (status === "unsupported") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <BellOff className="mt-0.5 size-4 shrink-0" />
        <p>
          Push notifications aren&apos;t available here. Open the app from your home
          screen (or install it with “Add to Home screen”) and try again.
        </p>
      </div>
    );
  }

  if (status === "unconfigured") {
    // Browser supports push, but NEXT_PUBLIC_VAPID_PUBLIC_KEY wasn't in the build.
    return (
      <div className="flex items-start gap-3 rounded-lg border border-dashed border-amber-400/60 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p>
          Push isn&apos;t configured on the server yet. The site was built without a
          VAPID public key. Set <code>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> (plus
          <code> VAPID_PRIVATE_KEY</code>) in the hosting environment and redeploy,
          then reopen this page.
        </p>
      </div>
    );
  }

  const blocked = permission === "denied";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="flex items-start gap-3">
          {subscribed ? (
            <Bell className="mt-0.5 size-5 text-primary" />
          ) : (
            <BellOff className="mt-0.5 size-5 text-muted-foreground" />
          )}
          <div className="space-y-1">
            <p className="text-sm font-medium">Push notifications on this device</p>
            <p className="text-sm text-muted-foreground">
              Get alerted when you&apos;re assigned a task or subtask, invited to a
              meeting, or one of your tasks is completed — even when the app is closed.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          <Switch
            checked={subscribed}
            disabled={busy || blocked}
            onCheckedChange={(next) => (next ? enable() : disable())}
            aria-label="Toggle push notifications"
          />
        </div>
      </div>

      {blocked && (
        <p className="text-sm text-destructive">
          Notifications are blocked for this app. Turn them on in your phone&apos;s
          settings (Apps → SWM → Notifications), then toggle this again.
        </p>
      )}
    </div>
  );
}
