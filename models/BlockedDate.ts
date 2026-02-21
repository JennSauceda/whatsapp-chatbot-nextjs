import mongoose, { Schema, models } from "mongoose";

const BlockedDateSchema = new Schema(
  {
    date: {
      type: String,
      required: true,
      unique: true,
    },
    reason: {
      type: String,
      default: "No disponible",
    },
  },
  { timestamps: true }
);

export default models.BlockedDate ||
  mongoose.model("BlockedDate", BlockedDateSchema);