import mongoose, { Schema, models, model } from "mongoose";

const AppointmentSchema = new Schema(
  {
    userWhatsapp: {
      type: String,
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

AppointmentSchema.index({ date: 1, time: 1 }, { unique: true });

export default models.Appointment || model("Appointment", AppointmentSchema);
