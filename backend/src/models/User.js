import mongoose from "mongoose";

const giftedTitleSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    color: { type: String, default: "#c56b4c" },
    gradient: { type: [String], default: [] },
    giftedBy: { type: String, default: "GrimmyEnding" },
    giftedAt: { type: Date, default: Date.now },
    seen: { type: Boolean, default: false },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  username: { type: String, unique: true, sparse: true },
  lastPostDate: { type: Date, default: null },
  isProxy: { type: Boolean, default: false },
  showTitle: { type: Boolean, default: true },
  activeTitleId: { type: String, default: null },
  unlockedTitleIds: { type: [String], default: [] },
  giftedTitles: { type: [giftedTitleSchema], default: [] },
});

export const User = mongoose.model("User", userSchema);
