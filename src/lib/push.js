import webpush from "web-push";

import { connectToDatabase } from "@/lib/db";
import { AppError } from "@/lib/errors";
import PushSubscription from "@/models/PushSubscription";

/**
 * Web Push notifications. This is the push counterpart of `email.js`: the same
 * events (task/subtask assigned, task completed, meeting invite) that send an
 * email also fire a push here, so an installed PWA / TWA app surfaces a native
 * notification even when it's closed.
 *
 * VAPID keys identify this server to the browser's push service. When they're
 * unset, push is silently disabled (mirrors how email no-ops without Gmail),
 * so the app keeps working in dev without any setup.
 */
const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@school.edu";

export const pushEnabled = !!(PUBLIC_KEY && PRIVATE_KEY);

if (pushEnabled) {
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
}

/** True when a value looks like a complete browser PushSubscription. */
function isValidSubscription(sub) {
  return !!(sub && sub.endpoint && sub.keys && sub.keys.p256dh && sub.keys.auth);
}

/**
 * Upsert a device's subscription, keyed on its unique push `endpoint`. If the
 * same browser was previously another user's (e.g. a shared device, new login),
 * `userId` is reassigned to the current owner; `createdAt` is only set on first
 * insert.
 */
export async function saveSubscription(userId, sub, userAgent = "") {
  if (!isValidSubscription(sub)) {
    throw new AppError("Invalid push subscription.", 400);
  }
  await connectToDatabase();
  await PushSubscription.findOneAndUpdate(
    { endpoint: sub.endpoint },
    {
      $set: {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        userId,
        userAgent: String(userAgent || "").slice(0, 300),
      },
      $setOnInsert: { createdAt: new Date().toISOString() },
    },
    { upsert: true }
  );
}

/** Remove a device's subscription (on opt-out). Scoped to its owner. */
export async function removeSubscription(userId, endpoint) {
  if (!endpoint) return;
  await connectToDatabase();
  await PushSubscription.deleteOne({ userId, endpoint });
}

/**
 * Send a notification to every device a user has opted in on. Best-effort:
 * failures are logged, and subscriptions the push service reports as gone
 * (404/410) are pruned so we don't keep retrying dead endpoints.
 *
 * `payload` is delivered to the service worker's `push` handler as JSON:
 *   { title, body, url, tag }
 */
export async function sendPushToUser(userId, payload) {
  if (!pushEnabled) {
    console.log(`[push skipped — VAPID not configured] "${payload?.title}" -> ${userId}`);
    return;
  }
  await connectToDatabase();
  const subs = await PushSubscription.find({ userId }).lean();
  if (!subs.length) return;

  const body = JSON.stringify(payload);
  const dead = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: s.keys },
          body,
          { TTL: 60 * 60 * 24 } // keep up to a day if the device is offline
        );
      } catch (err) {
        const code = err?.statusCode;
        if (code === 404 || code === 410) {
          dead.push(s.endpoint); // subscription expired / unsubscribed
        } else {
          console.error("Push send failed:", code, err?.body || err?.message || err);
        }
      }
    })
  );
  if (dead.length) {
    await PushSubscription.deleteMany({ endpoint: { $in: dead } });
  }
}

// ── Event helpers — one per notifiable event, parallel to email.js ──────────

export async function pushTaskAssigned({ userId, taskTitle, assignerName, taskId }) {
  await sendPushToUser(userId, {
    title: "New task assigned",
    body: `${assignerName} assigned you "${taskTitle}".`,
    url: `/tasks/${taskId}`,
    tag: `task-${taskId}`,
  });
}

export async function pushSubtaskAssigned({
  userId,
  subtaskTitle,
  taskTitle,
  assignerName,
  taskId,
  subtaskKey,
}) {
  await sendPushToUser(userId, {
    title: "New subtask assigned",
    body: `${assignerName} assigned you "${subtaskTitle}" in ${taskTitle}.`,
    url: `/tasks/${taskId}/${subtaskKey}`,
    tag: `subtask-${taskId}-${subtaskKey}`,
  });
}

export async function pushTaskDelayed({ userId, taskTitle, taskId }) {
  await sendPushToUser(userId, {
    title: "Task overdue ⚠️",
    body: `"${taskTitle}" has passed its due date.`,
    url: `/tasks/${taskId}`,
    tag: `task-${taskId}-delayed`,
  });
}

export async function pushSubtaskDelayed({
  userId,
  subtaskTitle,
  taskTitle,
  taskId,
  subtaskKey,
}) {
  await sendPushToUser(userId, {
    title: "Subtask overdue ⚠️",
    body: `"${subtaskTitle}" in ${taskTitle} has passed its expected date.`,
    url: `/tasks/${taskId}/${subtaskKey}`,
    tag: `subtask-${taskId}-${subtaskKey}-delayed`,
  });
}

export async function pushTaskCompleted({ userId, taskTitle, byName, taskId }) {
  await sendPushToUser(userId, {
    title: "Task completed ✅",
    body: `${byName} completed "${taskTitle}".`,
    url: `/tasks/${taskId}`,
    tag: `task-${taskId}-completed`,
  });
}

export async function pushRecurringAssigned({ userId, taskTitle, assignerName, recurringId }) {
  await sendPushToUser(userId, {
    title: "Recurring task assigned 🔁",
    body: `${assignerName} added you to "${taskTitle}". Upload a result each day.`,
    url: `/recurring/${recurringId}`,
    tag: `recurring-${recurringId}`,
  });
}

export async function pushRecurringReminder({ userId, taskTitle, recurringId }) {
  await sendPushToUser(userId, {
    title: "Today's log is due ⏰",
    body: `Upload today's result for "${taskTitle}".`,
    url: `/recurring/${recurringId}`,
    tag: `recurring-${recurringId}-reminder`,
  });
}

export async function pushMeetingInvite({ userId, title, byName, meetingId, when }) {
  await sendPushToUser(userId, {
    title: "Meeting invite",
    body: `${byName} invited you to "${title}"${when ? ` on ${when}` : ""}.`,
    url: `/meetings/${meetingId}`,
    tag: `meeting-${meetingId}`,
  });
}

export async function pushTaskSubmitted({ userId, taskTitle, byName, taskId }) {
  await sendPushToUser(userId, {
    title: "Submitted for review 📝",
    body: `${byName} submitted their part of "${taskTitle}" for review.`,
    url: `/tasks/${taskId}`,
    tag: `task-${taskId}-submitted`,
  });
}

export async function pushSubmissionReturned({ userId, taskTitle, byName, taskId }) {
  await sendPushToUser(userId, {
    title: "Changes requested",
    body: `${byName} sent your submission for "${taskTitle}" back for changes.`,
    url: `/tasks/${taskId}`,
    tag: `task-${taskId}-returned`,
  });
}

export async function pushTaskApproved({ userId, taskTitle, byName, taskId }) {
  await sendPushToUser(userId, {
    title: "Submission approved ✅",
    body: `${byName} approved your submission for "${taskTitle}".`,
    url: `/tasks/${taskId}`,
    tag: `task-${taskId}-approved`,
  });
}

export async function pushSubtaskSubmitted({
  userId,
  subtaskTitle,
  taskTitle,
  byName,
  taskId,
  subtaskKey,
}) {
  await sendPushToUser(userId, {
    title: "Subtask submitted for review 📝",
    body: `${byName} submitted "${subtaskTitle}" (${taskTitle}) for your review.`,
    url: `/tasks/${taskId}/${subtaskKey}`,
    tag: `subtask-${taskId}-${subtaskKey}-submitted`,
  });
}

export async function pushSubtaskApproved({
  userId,
  subtaskTitle,
  taskTitle,
  byName,
  taskId,
  subtaskKey,
}) {
  await sendPushToUser(userId, {
    title: "Subtask approved ✅",
    body: `${byName} approved "${subtaskTitle}" (${taskTitle}).`,
    url: `/tasks/${taskId}/${subtaskKey}`,
    tag: `subtask-${taskId}-${subtaskKey}-approved`,
  });
}

export async function pushSubtaskReturned({
  userId,
  subtaskTitle,
  taskTitle,
  byName,
  taskId,
  subtaskKey,
}) {
  await sendPushToUser(userId, {
    title: "Subtask sent back",
    body: `${byName} sent "${subtaskTitle}" (${taskTitle}) back for changes.`,
    url: `/tasks/${taskId}/${subtaskKey}`,
    tag: `subtask-${taskId}-${subtaskKey}-returned`,
  });
}
