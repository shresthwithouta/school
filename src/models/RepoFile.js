import { Schema, model, models } from "mongoose";

// A file saved into the Admin-managed Repository. It owns its own Cloudinary
// asset (copied on save) so it survives deletion of the task/meeting it came
// from. `sharedWith` holds the user ids the Admin has shared it with — those
// users see it in their own Repository view.
const RepoFileSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
    resourceType: { type: String, default: "image" },
    format: { type: String, default: "" },
    bytes: { type: Number, default: 0 },
    name: { type: String, required: true },
    kind: { type: String, default: "file" },
    // Provenance (optional): where the Admin saved it from.
    sourceType: { type: String, default: "" }, // task | meeting | upload
    sourceId: { type: String, default: "" },
    sourceTitle: { type: String, default: "" },
    savedById: { type: String, required: true },
    savedByName: { type: String, default: "" },
    sharedWith: { type: [String], default: [] },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { collection: "repofiles", versionKey: false, minimize: false }
);

RepoFileSchema.index({ sharedWith: 1 });
RepoFileSchema.index({ savedById: 1 });

const RepoFile = models.RepoFile || model("RepoFile", RepoFileSchema);
export default RepoFile;
