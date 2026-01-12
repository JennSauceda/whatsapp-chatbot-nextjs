import mongoose, { Schema, model, models } from "mongoose";

const SessionSchema = new Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
    },
    currentStep: {
      type: String,
      required: true,
      default: "MENU",
    },
    tempData: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export default models.Session || model("Session", SessionSchema);
