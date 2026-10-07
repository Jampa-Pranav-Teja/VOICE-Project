export const ADMIN_EMAIL = "pranavtejajampa@gmail.com";
export const ADMIN_DISPLAY_NAME = "GrimEnding";

export const ACHIEVEMENT_TITLES = [
  {
    id: "newbie",
    name: "newbie",
    color: "#6b8f71",
    kind: "achievement",
    minUpvotes: 10,
    minPosts: 0,
  },
  {
    id: "storyteller",
    name: "storyteller",
    color: "#7a6b8a",
    kind: "achievement",
    minUpvotes: 0,
    minPosts: 3,
  },
  {
    id: "rising",
    name: "rising",
    color: "#c56b4c",
    kind: "achievement",
    minUpvotes: 25,
    minPosts: 0,
  },
  {
    id: "chronicler",
    name: "chronicler",
    color: "#4a6b8a",
    kind: "achievement",
    minUpvotes: 0,
    minPosts: 7,
  },
  {
    id: "beloved",
    name: "beloved",
    color: "#8b5a7a",
    kind: "achievement",
    minUpvotes: 50,
    minPosts: 0,
  },
  {
    id: "legend",
    name: "legend",
    color: "#b8860b",
    kind: "achievement",
    minUpvotes: 100,
    minPosts: 10,
  },
];

export function isAdmin(user) {
  return String(user?.email || "").toLowerCase() === ADMIN_EMAIL;
}

export function achievementById(id) {
  return ACHIEVEMENT_TITLES.find((title) => title.id === id) || null;
}

export function unlockedAchievementIds(totalUpvotes, postCount) {
  return ACHIEVEMENT_TITLES.filter(
    (title) =>
      totalUpvotes >= title.minUpvotes && postCount >= title.minPosts
  ).map((title) => title.id);
}

export function ownedTitles(user) {
  const list = [];
  for (const id of user.unlockedTitleIds || []) {
    const meta = achievementById(id);
    if (meta) {
      list.push({
        id: meta.id,
        name: meta.name,
        color: meta.color,
        kind: "achievement",
      });
    }
  }
  for (const gift of user.giftedTitles || []) {
    list.push({
      id: gift.id,
      name: gift.name,
      color: gift.color || "#c56b4c",
      kind: "gift",
    });
  }
  return list;
}

export function resolveDisplayTitle(user) {
  if (!user || user.showTitle === false) return null;
  if (!user.activeTitleId) return null;
  return ownedTitles(user).find((title) => title.id === user.activeTitleId) || null;
}

export function pendingGift(user) {
  const gift = (user.giftedTitles || []).find((item) => !item.seen);
  if (!gift) return null;
  return {
    id: gift.id,
    name: gift.name,
    from: ADMIN_DISPLAY_NAME,
  };
}

export function catalogForUser(user, totalUpvotes = 0, postCount = 0) {
  const owned = new Set((user.unlockedTitleIds || []).concat(
    (user.giftedTitles || []).map((g) => g.id)
  ));
  return {
    achievements: ACHIEVEMENT_TITLES.map((title) => ({
      id: title.id,
      name: title.name,
      color: title.color,
      kind: "achievement",
      unlocked: owned.has(title.id),
      requirement:
        title.minUpvotes && title.minPosts
          ? `${title.minUpvotes} upvotes and ${title.minPosts} posts`
          : title.minUpvotes
            ? `${title.minUpvotes} upvotes received`
            : `${title.minPosts} ${title.minPosts === 1 ? "post" : "posts"}`,
      progress: {
        upvotes: totalUpvotes,
        posts: postCount,
        needUpvotes: title.minUpvotes,
        needPosts: title.minPosts,
      },
    })),
    gifts: (user.giftedTitles || []).map((gift) => ({
      id: gift.id,
      name: gift.name,
      color: gift.color || "#c56b4c",
      kind: "gift",
      unlocked: true,
    })),
  };
}
