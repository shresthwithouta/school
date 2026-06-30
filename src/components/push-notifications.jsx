"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, Loader2, AlertTriangle } from "lucide-react";

import { Switch } from "@/components/ui/switch";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// Push wants the VAPID public key as a byte array, not the base64url string.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Read current notification permission. Some app webviews don't expose
// window.Notification even though push works, so fall back to the Permissions API.
async function readPermission() {
  if (typeof Notification !== "undefined" && Notification.permission) {
    return Notification.permission;
  }
  try {
    const status = await navigator.permissions?.query({ name: "notifications" });
    if (status) return status.state === "prompt" ? "default" : status.state;
  } catch {
    // Permissions API not available / doesn't know "notifications".
  }
  return "default";
}

// Ask for permission. Prefer Notification.requestPermission when present; if it
// isn't (some TWAs), let pushManager.subscribe() trigger the prompt instead.
async function requestPermission() {
  if (typeof Notification !== "undefined" && Notification.requestPermission) {
    return Notification.requestPermission();
  }
  return "granted"; // optimistic — subscribe() will reject if it's actually blocked
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Request failed");
  }
}

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
      const canPush =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window;
      if (cancelled) return;
      if (!canPush) {
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
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
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
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      await postJSON("/api/push/subscribe", { subscription: sub.toJSON(), welcome: true });
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
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const { endpoint } = sub;
        await sub.unsubscribe();
        await postJSON("/api/push/unsubscribe", { endpoint });
      }
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
