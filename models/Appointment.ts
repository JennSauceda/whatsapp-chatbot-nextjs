import mongoose, { Schema, model, models } from "mongoose";

const AppointmentSchema = new Schema(
  {
    userPhone: {
      type: String,
      required: true,
    },
    date: {
      type: String, // puedes cambiar a Date luego
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "cancelled"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

export default models.Appointment ||
  model("Appointment", AppointmentSchema);
