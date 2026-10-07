import { randomBytes } from "crypto";
import { Story } from "./models/Story.js";
import {
  ACHIEVEMENT_TITLES,
  ADMIN_DISPLAY_NAME,
  OWNER_TITLE,
  OWNER_TITLE_ID,
  isAdmin,
  unlockedAchievementIds,
} from "./titles.js";

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
  const unlocked = isAdmin(user)
    ? ACHIEVEMENT_TITLES.map((title) => title.id)
    : unlockedAchievementIds(totalUpvotes, postCount);
  const current = new Set(user.unlockedTitleIds || []);
  const newlyUnlocked = [];
  let changed = false;

  for (const id of unlocked) {
    if (!current.has(id)) {
      current.add(id);
      newlyUnlocked.push(id);
      changed = true;
    }
  }

  if (isAdmin(user)) {
    const gifts = [...(user.giftedTitles || [])];
    const hasOwner = gifts.some((gift) => gift.id === OWNER_TITLE_ID);
    if (!hasOwner) {
      gifts.unshift({
        id: OWNER_TITLE_ID,
        name: OWNER_TITLE.name,
        color: OWNER_TITLE.color,
        giftedBy: ADMIN_DISPLAY_NAME,
        giftedAt: new Date(),
        seen: true,
      });
      user.giftedTitles = gifts;
      changed = true;
    }
    if (!user.activeTitleId || user.showTitle === false) {
      user.activeTitleId = OWNER_TITLE_ID;
      user.showTitle = true;
      changed = true;
    }
  }

  if (changed) {
    user.unlockedTitleIds = [...current];
    await user.save();
  }

  return { postCount, totalUpvotes, newlyUnlocked };
}

export function newGiftId() {
  return `gift_${randomBytes(6).toString("hex")}`;
}
