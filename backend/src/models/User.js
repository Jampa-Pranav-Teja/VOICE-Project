import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  username: { type: String, unique: true, sparse: true },
  lastPostDate: { type: Date, default: null },
  isProxy: { type: Boolean, default: false },
});

export const User = mongoose.model("User", userSchema);
