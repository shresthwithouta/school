"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import {
  VAPID_PUBLIC_KEY,
  pushSupported,
  readPermission,
  requestPermission,
  subscribeThisDevice,
  getExistingSubscription,
} from "@/lib/push-client";

// Once a device has been asked and said "not now" (or dismissed the prompt), we
// wait this long before nudging again — so it never nags on every login.
const DISMISS_KEY = "swm:push-prompt:dismissedAt";
const DISMISS_DAYS = 14;

function dismissedRecently() {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    return (Date.now() - Number(v)) / 86_400_000 < DISMISS_DAYS;
  } catch {
    return false;
  }
}

function rememberDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Private mode / storage disabled — worst case we ask again next login.
  }
}

async function enableFromPrompt() {
  try {
    const perm = await requestPermission();
    if (perm === "denied") {
      toast.error(
        "Notifications are blocked. You can turn them on later in Settings → Notifications."
      );
      return;
    }
    // The user dismissed the browser's own dialog — leave it for next time.
    if (perm !== "granted") return;
    await subscribeThisDevice({ welcome: true });
    toast.success("Notifications enabled");
  } catch (err) {
    toast.error(err?.message || "Could not enable notifications");
  }
}

/**
 * Rendered from the authenticated app layout, so it runs the first time a user
 * lands on the app after signing in (or after their account is created and they
 * log in). If they've never decided on notifications, it nudges them once with a
 * gentle prompt whose button opens the browser's native permission dialog. If
 * they've already allowed them, it quietly makes sure this device is subscribed.
 * Renders nothing.
 */
export function PushAutoPrompt() {
  useEffect(() => {
    let cancelled = false;
    let timer;

    async function run() {
      // Let the page paint first, and never touch state during render.
      await Promise.resolve();
      if (cancelled) return;
      if (!pushSupported() || !VAPID_PUBLIC_KEY) return;

      const permission = await readPermission();
      if (cancelled) return;

      if (permission === "granted") {
        // Already opted in — silently ensure this device is registered (e.g. a
        // new device, or a subscription that expired and was pruned).
        try {
          const existing = await getExistingSubscription();
          if (!existing) await subscribeThisDevice();
        } catch {
          // Best-effort; the Settings toggle is always there as a fallback.
        }
        return;
      }

      // Blocked, or asked-and-dismissed recently — don't nag.
      if (permission === "denied" || dismissedRecently()) return;

      // Nudge once, a beat after landing so it doesn't fight the first paint.
      timer = setTimeout(() => {
        if (cancelled) return;
        rememberDismiss(); // shown once — next nudge is DISMISS_DAYS away
        toast("Turn on notifications?", {
          id: "push-auto-prompt",
          duration: Infinity,
          description:
            "Get alerted about new tasks, subtasks, reviews and meetings — even when the app is closed.",
          action: {
            label: "Enable",
            onClick: () => enableFromPrompt(),
          },
          cancel: {
            label: "Not now",
            onClick: () => {},
          },
        });
      }, 1200);
    }

    run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return null;
}
