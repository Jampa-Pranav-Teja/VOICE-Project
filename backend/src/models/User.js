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

const adminNoteSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    body: { type: String, required: true, maxlength: 2000 },
    from: { type: String, default: "GrimmyEnding" },
    createdAt: { type: Date, default: Date.now },
    seen: { type: Boolean, default: false },
    reply: { type: String, default: null, maxlength: 2000 },
    replyAt: { type: Date, default: null },
    replySeen: { type: Boolean, default: false },
  },
  { _id: false }
);

const takedownNoticeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    reason: { type: String, required: true, maxlength: 2000 },
    storyPreview: { type: String, default: "", maxlength: 280 },
    createdAt: { type: Date, default: Date.now },
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
  adminNotes: { type: [adminNoteSchema], default: [] },
  takedownNotices: { type: [takedownNoticeSchema], default: [] },
});

export const User = mongoose.model("User", userSchema);
