/**
 * Client-only Web Push helpers, shared by the Settings toggle
 * (`push-notifications.jsx`) and the login-time prompt (`push-auto-prompt.jsx`).
 *
 * Browser APIs only — safe to import from client components, never on the server.
 * The server counterpart (sending pushes, storing subscriptions) lives in
 * `lib/push.js`.
 */

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** True when this browser can register a service worker and receive push. */
export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

/** Push wants the VAPID public key as a byte array, not the base64url string. */
export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Read the current notification permission. Some app webviews don't expose
 * window.Notification even though push works, so fall back to the Permissions API.
 * Returns "default" | "granted" | "denied".
 */
export async function readPermission() {
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

/**
 * Ask for permission. Prefer Notification.requestPermission when present; if it
 * isn't (some TWAs), let pushManager.subscribe() trigger the prompt instead.
 * Must be called from a user gesture on most browsers.
 */
export async function requestPermission() {
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

/** The existing push subscription for this device, or null. */
export async function getExistingSubscription() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/**
 * Subscribe this device (reusing an existing subscription if there is one) and
 * persist it to the server. `welcome` asks the server to send one confirmation
 * push so the user sees straight away that it works. Returns the subscription.
 */
export async function subscribeThisDevice({ welcome = false } = {}) {
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  await postJSON("/api/push/subscribe", { subscription: sub.toJSON(), welcome });
  return sub;
}

/** Remove this device's subscription (opt-out). */
export async function unsubscribeThisDevice() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const { endpoint } = sub;
  await sub.unsubscribe();
  await postJSON("/api/push/unsubscribe", { endpoint });
}
