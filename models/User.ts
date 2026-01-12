import mongoose, { Schema, model, models } from "mongoose";

const UserSchema = new Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default models.User || model("User", UserSchema);
