import mongoose from "mongoose";

const storySchema = new mongoose.Schema({
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  authorUsername: { type: String, required: true },
  content: { type: String, required: true, maxlength: 50000 },
  upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now },
});

export const Story = mongoose.model("Story", storySchema);
