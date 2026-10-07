import { randomBytes } from "crypto";
import { Story } from "./models/Story.js";
import { unlockedAchievementIds } from "./titles.js";

export async function authorTotals(userId) {
  const stories = await Story.find({ authorId: userId }, { upvotes: 1 }).lean();
  const postCount = stories.length;
  const totalUpvotes = stories.reduce(
    (sum, story) => sum + (story.upvotes?.length || 0),
    0
  );
  return { postCount, totalUpvotes };
}

export async function syncUnlockedTitles(user) {
  const { postCount, totalUpvotes } = await authorTotals(user._id);
  const unlocked = unlockedAchievementIds(totalUpvotes, postCount);
  const current = new Set(user.unlockedTitleIds || []);
  const newlyUnlocked = [];
  for (const id of unlocked) {
    if (!current.has(id)) {
      current.add(id);
      newlyUnlocked.push(id);
    }
  }
  if (newlyUnlocked.length) {
    user.unlockedTitleIds = [...current];
    await user.save();
  }
  return { postCount, totalUpvotes, newlyUnlocked };
}

export function newGiftId() {
  return `gift_${randomBytes(6).toString("hex")}`;
}
