import { createHash } from "crypto";
import { User } from "./models/User.js";
import { Story } from "./models/Story.js";
import { postedToday } from "./auth.js";
import { moderateStory } from "./moderate.js";

const SUBREDDITS = [
  "offmychest",
  "TrueOffMyChest",
  "confession",
  "CasualConversation",
  "self",
];

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const MAX_PROXY_POSTS_PER_DAY = 4;
const POST_INTERVAL_MS = 25 * 60 * 1000;
const UPVOTE_INTERVAL_MS = 4 * 60 * 1000;

let running = false;

function hashContent(content) {
  return createHash("sha256").update(content).digest("hex");
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function decodeHtml(text) {
  return String(text || "")
    .replace(/&#x200B;/gi, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function storyFromPost(data) {
  if (!data || data.over_18 || data.stickied || data.pinned) return null;
  const title = decodeHtml(data.title);
  const body = decodeHtml(data.selftext);
  if (!title || !body || body === "[removed]" || body === "[deleted]") return null;
  if (body.length < 350) return null;
  const content = `${title}\n\n${body}`.slice(0, 50000).trim();
  if (content.length < 400) return null;
  return {
    content,
    hash: hashContent(content),
  };
}

async function fetchRedditListing(sub) {
  const hosts = ["https://www.reddit.com", "https://old.reddit.com"];
  for (const host of hosts) {
    const url = `${host}/r/${sub}/top.json?t=month&limit=40`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });
    if (!res.ok) continue;
    const json = await res.json();
    return (json?.data?.children || []).map((child) => child?.data).filter(Boolean);
  }
  return [];
}

async function fetchArchiveListing(sub) {
  const url = `https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=${encodeURIComponent(sub)}&limit=50`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json?.data || [];
}

async function fetchRedditCandidates() {
  const shuffled = [...SUBREDDITS].sort(() => Math.random() - 0.5);
  const candidates = [];

  for (const sub of shuffled) {
    try {
      let posts = await fetchRedditListing(sub);
      if (!posts.length) posts = await fetchArchiveListing(sub);
      for (const post of posts) {
        const story = storyFromPost(post);
        if (story) candidates.push(story);
      }
      if (candidates.length >= 20) break;
    } catch (err) {
      console.error(`Reddit fetch failed for r/${sub}:`, err.message);
    }
  }

  return candidates.sort(() => Math.random() - 0.5);
}

async function utcDayStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function maybePost(max = 1) {
  const proxies = await User.find({ isProxy: true });
  const available = proxies.filter((user) => !postedToday(user.lastPostDate));
  if (!available.length) return 0;

  const since = await utcDayStart();
  const postedTodayCount = await Story.countDocuments({
    authorId: { $in: proxies.map((user) => user._id) },
    createdAt: { $gte: since },
  });
  if (postedTodayCount >= MAX_PROXY_POSTS_PER_DAY) return 0;

  const room = Math.min(max, MAX_PROXY_POSTS_PER_DAY - postedTodayCount);
  const candidates = await fetchRedditCandidates();
  if (!candidates.length) {
    console.warn("Community: no Reddit stories available");
    return 0;
  }

  let posted = 0;
  for (const candidate of candidates) {
    if (posted >= room) break;
    const duplicate = await Story.findOne({ sourceHash: candidate.hash });
    if (duplicate) continue;

    let moderation;
    try {
      moderation = await moderateStory(candidate.content);
    } catch (err) {
      console.error("Community moderation failed:", err.message);
      continue;
    }
    if (!moderation.approved) continue;

    const author = available.find((user) => !postedToday(user.lastPostDate));
    if (!author) break;

    await Story.create({
      authorId: author._id,
      authorUsername: author.username,
      content: candidate.content,
      upvotes: [],
      sourceHash: candidate.hash,
    });
    author.lastPostDate = new Date();
    await author.save();
    posted += 1;
    console.log(`Community posted as ${author.username}`);
  }

  return posted;
}

async function maybeUpvote() {
  const proxies = await User.find({ isProxy: true });
  if (!proxies.length) return 0;

  const stories = await Story.find().sort({ createdAt: -1 }).limit(50);
  if (!stories.length) return 0;

  const votes = 1 + Math.floor(Math.random() * 3);
  let applied = 0;
  const quieter = stories.filter((story) => (story.upvotes || []).length < 12);
  const pool = quieter.length ? quieter : stories;

  for (let i = 0; i < votes; i += 1) {
    const story = pick(pool);
    const eligible = proxies.filter((user) => {
      if (String(user._id) === String(story.authorId)) return false;
      return !story.upvotes.some((id) => String(id) === String(user._id));
    });
    if (!eligible.length) continue;
    const voter = pick(eligible);
    story.upvotes.push(voter._id);
    await story.save();
    applied += 1;
  }

  return applied;
}

export async function communityStats() {
  const totalUsers = await User.countDocuments();
  const proxyCount = await User.countDocuments({ isProxy: true });
  const bucket = Math.floor(Date.now() / (3 * 60 * 1000));
  const wave = (Math.sin(bucket / 8) + 1) / 2;
  const activeProxies = Math.max(
    5,
    Math.min(proxyCount, Math.round(proxyCount * (0.32 + wave * 0.28)))
  );
  const realActive = await User.countDocuments({
    isProxy: { $ne: true },
    lastPostDate: { $gte: new Date(Date.now() - 36 * 60 * 60 * 1000) },
  });

  return {
    totalUsers,
    activeUsers: activeProxies + realActive,
  };
}

export async function runCommunityTick(startup = false) {
  if (running) return;
  running = true;
  try {
    await maybeUpvote();
    await maybePost(startup ? 3 : 1);
  } catch (err) {
    console.error("Community tick failed:", err.message);
  } finally {
    running = false;
  }
}

export function startCommunity() {
  setTimeout(() => runCommunityTick(true), 12_000);
  setInterval(() => runCommunityTick(false), POST_INTERVAL_MS);
  setInterval(() => {
    maybeUpvote().catch((err) =>
      console.error("Community upvote failed:", err.message)
    );
  }, UPVOTE_INTERVAL_MS);
  console.log("Community proxies started");
}
