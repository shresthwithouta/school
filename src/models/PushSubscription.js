import { Schema, model, models } from "mongoose";

/**
 * A single Web Push subscription = one browser/device a user has opted in on.
 * A user can have many (phone PWA, desktop, etc.), so we key on the push
 * service `endpoint` (globally unique) rather than the user. Re-subscribing the
 * same device upserts on `endpoint` so we never accumulate duplicates.
 *
 * `keys.p256dh` / `keys.auth` are the browser-provided encryption keys that
 * web-push needs to encrypt the payload — without them the push can't be sent.
 */
const PushSubscriptionSchema = new Schema(
  {
    endpoint: { type: String, required: true, unique: true, index: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    // App-level user id (string `id`, not Mongo `_id`) this device belongs to.
    userId: { type: String, required: true, index: true },
    // Best-effort label for debugging / a future "your devices" list.
    userAgent: { type: String, default: "" },
    createdAt: { type: String, required: true },
  },
  { collection: "push_subscriptions", versionKey: false }
);

const PushSubscription =
  models.PushSubscription || model("PushSubscription", PushSubscriptionSchema);
export default PushSubscription;
