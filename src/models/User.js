import { Schema, model, models } from "mongoose";

/**
 * We use a string `id` (uuid / "seed-N") as the app-level identifier so the
 * data shape stays identical to the previous file store. Mongo's own `_id` is
 * ignored by the app and stripped before data leaves this layer.
 */
const UserSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    // select:false so the hash never rides along on ordinary reads — it must be
    // explicitly re-selected (login + password change) to be loaded at all.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true },
    department: { type: String, default: "" },
    phone: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    bio: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    createdBy: { type: String, default: null },
    lastLoginAt: { type: String, default: null },
    createdAt: { type: String, required: true },
  },
  { collection: "users", versionKey: false }
);

const User = models.User || model("User", UserSchema);
export default User;
