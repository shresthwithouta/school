import { Schema, model, models } from "mongoose";

/** Simple atomic counter (e.g. for sequential, Jira-style task numbers). */
const CounterSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    seq: { type: Number, default: 0 },
  },
  { collection: "counters", versionKey: false }
);

const Counter = models.Counter || model("Counter", CounterSchema);
export default Counter;
