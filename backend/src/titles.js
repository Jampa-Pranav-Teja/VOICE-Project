export const ADMIN_EMAIL = "pranavtejajampa@gmail.com";
export const ADMIN_DISPLAY_NAME = "GrimmyEnding";
export const OWNER_TITLE_ID = "owner";

const GRADIENT_PALETTE = [
  "#c56b4c",
  "#b8860b",
  "#8b5a7a",
  "#4a6b8a",
  "#6b8f71",
  "#d27a5a",
  "#7a6b8a",
  "#2f6f8f",
  "#a65d7a",
  "#c9a227",
  "#5c7cfa",
  "#e8590c",
  "#0ca678",
  "#9c36b5",
  "#e67700",
  "#364fc7",
];

export function randomGiftGradient() {
  const pool = [...GRADIENT_PALETTE];
  const colors = [];
  while (colors.length < 4 && pool.length) {
    const index = Math.floor(Math.random() * pool.length);
    colors.push(pool.splice(index, 1)[0]);
  }
  colors.push(colors[0]);
  return colors;
}

export const OWNER_TITLE = {
  id: OWNER_TITLE_ID,
  name: "Owner",
  color: "#d4af37",
  kind: "owner",
  gradient: ["#fff4c2", "#ffe08a", "#d4af37", "#f7e7a1", "#b8860b", "#fff1a8", "#d4af37"],
};

export const ACHIEVEMENT_TITLES = [
  {
    id: "newbie",
    name: "Newbie",
    color: "#6b8f71",
    kind: "achievement",
    minUpvotes: 10,
    minPosts: 0,
  },
  {
    id: "storyteller",
    name: "Storyteller",
    color: "#7a6b8a",
    kind: "achievement",
    minUpvotes: 0,
    minPosts: 3,
  },
  {
    id: "rising",
    name: "Rising",
    color: "#c56b4c",
    kind: "achievement",
    minUpvotes: 25,
    minPosts: 0,
  },
  {
    id: "chronicler",
    name: "Chronicler",
    color: "#4a6b8a",
    kind: "achievement",
    minUpvotes: 0,
    minPosts: 7,
  },
  {
    id: "beloved",
    name: "Beloved",
    color: "#8b5a7a",
    kind: "achievement",
    minUpvotes: 50,
    minPosts: 0,
  },
  {
    id: "legend",
    name: "Legend",
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

export function titleKindForGift(gift) {
  if (gift?.id === OWNER_TITLE_ID || gift?.kind === "owner") return "owner";
  return "gift";
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
    const kind = titleKindForGift(gift);
    list.push({
      id: gift.id,
      name: gift.name,
      color: gift.color || (kind === "owner" ? OWNER_TITLE.color : "#c56b4c"),
      kind,
      gradient:
        gift.gradient?.length
          ? gift.gradient
          : kind === "owner"
            ? OWNER_TITLE.gradient
            : null,
    });
  }
  if (isAdmin(user) && !list.some((title) => title.id === OWNER_TITLE_ID)) {
    list.unshift({ ...OWNER_TITLE });
  }
  return list;
}

export function resolveDisplayTitle(user) {
  if (!user || user.showTitle === false) return null;
  if (!user.activeTitleId) return null;
  return ownedTitles(user).find((title) => title.id === user.activeTitleId) || null;
}

export function pendingGift(user) {
  const gift = (user.giftedTitles || []).find(
    (item) => !item.seen && item.id !== OWNER_TITLE_ID
  );
  if (!gift) return null;
  return {
    id: gift.id,
    name: gift.name,
    kind: titleKindForGift(gift),
    gradient: gift.gradient || null,
    from: gift.giftedBy || ADMIN_DISPLAY_NAME,
  };
}

export function catalogForUser(user, totalUpvotes = 0, postCount = 0) {
  const owned = new Set(
    (user.unlockedTitleIds || []).concat((user.giftedTitles || []).map((g) => g.id))
  );
  if (isAdmin(user)) {
    for (const title of ACHIEVEMENT_TITLES) owned.add(title.id);
    owned.add(OWNER_TITLE_ID);
  }
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
    gifts: [
      ...(isAdmin(user) || owned.has(OWNER_TITLE_ID)
        ? [{ ...OWNER_TITLE, unlocked: true }]
        : []),
      ...(user.giftedTitles || [])
        .filter((gift) => gift.id !== OWNER_TITLE_ID)
        .map((gift) => ({
          id: gift.id,
          name: gift.name,
          color: gift.color || "#c56b4c",
          kind: "gift",
          gradient: gift.gradient || null,
          unlocked: true,
        })),
    ],
  };
}
