import "dotenv/config";
import cors from "cors";
import express from "express";
import { connectDb } from "./db.js";
import { User } from "./models/User.js";
import { Story } from "./models/Story.js";
import {
  googleClientId,
  normalizeUsername,
  postedToday,
  publicUser,
  requireAdmin,
  requireAuth,
  requireUsername,
  signToken,
  verifyGoogleAccessToken,
  verifyGoogleToken,
} from "./auth.js";
import { groqApiKey, moderateStory } from "./moderate.js";
import { communityStats, startCommunity } from "./community.js";
import {
  ADMIN_DISPLAY_NAME,
  catalogForUser,
  isAdmin,
  ownedTitles,
  randomGiftGradient,
  resolveDisplayTitle,
} from "./titles.js";
import { authorTotals, newGiftId, syncUnlockedTitles } from "./userStats.js";
import {
  newMessageId,
  pendingReplyForAdmin,
} from "./messages.js";
import { randomBytes } from "crypto";

const app = express();
const PORT = process.env.PORT || 4000;

async function authExtras(user) {
  return {
    pendingReply: await pendingReplyForAdmin(user),
  };
}

function serializeStory(story, userId, authorTitle = null) {
  const upvotes = (story.upvotes || []).map((id) => String(id));
  return {
    id: String(story._id),
    authorId: String(story.authorId),
    authorUsername: story.authorUsername,
    authorTitle,
    content: story.content,
    upvoteCount: upvotes.length,
    upvoted: userId ? upvotes.includes(String(userId)) : false,
    createdAt: story.createdAt,
  };
}

async function titlesByAuthorIds(authorIds) {
  const unique = [...new Set(authorIds.map(String).filter(Boolean))];
  if (!unique.length) return new Map();
  const authors = await User.find({ _id: { $in: unique } });
  const map = new Map();
  for (const author of authors) {
    map.set(String(author._id), resolveDisplayTitle(author));
  }
  return map;
}

async function serializeStories(stories, viewerId) {
  const titleMap = await titlesByAuthorIds(stories.map((story) => story.authorId));
  return stories.map((story) =>
    serializeStory(story, viewerId, titleMap.get(String(story.authorId)) || null)
  );
}

const allowedOrigins = [
  "https://exodreamai.in",
  "https://www.exodreamai.in",
  process.env.FRONTEND_URL,
  "http://localhost:5173",
]
  .filter(Boolean)
  .map((origin) => origin.replace(/\/$/, ""));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  const frontend = process.env.FRONTEND_URL || "http://localhost:5173";
  res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>voice api</title>
    <style>
      body { font-family: Georgia, serif; max-width: 36rem; margin: 6rem auto; color: #111; }
      a { color: #111; }
    </style>
  </head>
  <body>
    <h1>voice api</h1>
    <p>This is the backend. Open the app at <a href="${frontend}">${frontend}</a>.</p>
  </body>
</html>`);
});

app.get("/health", async (_req, res) => {
  const stats = await communityStats().catch(() => ({
    totalUsers: 0,
    activeUsers: 0,
  }));
  res.json({
    ok: true,
    app: "voice",
    models: [User.modelName, Story.modelName],
    groqKeyLength: groqApiKey().length,
    ...stats,
  });
});

app.get("/stats", async (_req, res) => {
  try {
    res.json(await communityStats());
  } catch (err) {
    console.error("Stats failed:", err.message);
    res.status(500).json({ error: "Could not load stats" });
  }
});

app.post("/auth/google", async (req, res) => {
  try {
    if (!googleClientId) {
      return res.status(500).json({ error: "GOOGLE_CLIENT_ID is not configured" });
    }

    const { credential, access_token } = req.body || {};
    if (!credential && !access_token) {
      return res.status(400).json({ error: "Missing Google credential" });
    }

    const payload = credential
      ? await verifyGoogleToken(credential)
      : await verifyGoogleAccessToken(access_token);
    let user = await User.findOne({ googleId: payload.sub });
    if (!user) {
      user = await User.create({
        googleId: payload.sub,
        email: payload.email,
      });
    } else if (payload.email && user.email !== payload.email) {
      user.email = payload.email;
      await user.save();
    }

    await syncUnlockedTitles(user);

    res.json({
      token: signToken(user),
      user: publicUser(user),
      needsUsername: !user.username,
      ...(await authExtras(user)),
      ...(await communityStats()),
    });
  } catch (err) {
    console.error("Google auth failed:", err.message);
    res.status(401).json({ error: "Google sign-in failed" });
  }
});

app.get("/auth/me", requireAuth, async (req, res) => {
  await syncUnlockedTitles(req.user);
  res.json({
    user: publicUser(req.user),
    needsUsername: !req.user.username,
    ...(await authExtras(req.user)),
    ...(await communityStats()),
  });
});

app.post("/auth/username", requireAuth, async (req, res) => {
  try {
    if (req.user.username) {
      return res.json({ user: publicUser(req.user) });
    }

    const username = normalizeUsername(req.body?.username);
    if (!username) {
      return res.status(400).json({
        error: "Use 3–20 characters: lowercase letters, numbers, or underscore",
      });
    }

    const taken = await User.findOne({ username });
    if (taken) {
      if (String(taken._id) === String(req.user._id)) {
        return res.json({ user: publicUser(taken) });
      }
      return res.status(409).json({ error: "That username is taken" });
    }

    req.user.username = username;
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "That username is taken" });
    }
    console.error("Set username failed:", err.message);
    res.status(500).json({ error: "Could not set username" });
  }
});

app.post("/stories", requireAuth, requireUsername, async (req, res) => {
  try {
    const content = String(req.body?.content || "").trim();
    if (!content) {
      return res.status(400).json({ error: "Write a story before publishing" });
    }
    if (content.length > 50000) {
      return res.status(400).json({ error: "Stories can be at most 50,000 characters" });
    }
    if (postedToday(req.user.lastPostDate)) {
      return res.status(429).json({ error: "You can only publish one story per day" });
    }

    const moderation = await moderateStory(content);
    if (!moderation.approved) {
      return res.status(422).json({
        error: moderation.reason || "This story was not approved",
        approved: false,
        reason: moderation.reason,
      });
    }

    const story = await Story.create({
      authorId: req.user._id,
      authorUsername: req.user.username,
      content,
      upvotes: [],
    });

    req.user.lastPostDate = new Date();
    await req.user.save();
    await syncUnlockedTitles(req.user);

    res.status(201).json({
      story: serializeStory(story, req.user._id, resolveDisplayTitle(req.user)),
    });
  } catch (err) {
    console.error("Create story failed:", err.message);
    console.error(err);
    if (err.message === "GROQ_API_KEY is not configured") {
      return res.status(500).json({
        error: "Story check is busy right now. Please try again in a little while.",
      });
    }
    if (err.status === 502 || err.public) {
      return res.status(502).json({
        error: "Story check is busy right now. Please try again in a little while.",
        reason: "Story check is busy right now. Please try again in a little while.",
      });
    }
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({
      error: "Could not publish story. Please try again in a little while.",
    });
  }
});

app.get("/stories", requireAuth, async (req, res) => {
  try {
    const sort = req.query.sort === "upvotes" ? "upvotes" : "date";
    const stories = await Story.aggregate([
      { $addFields: { upvoteCount: { $size: { $ifNull: ["$upvotes", []] } } } },
      {
        $sort:
          sort === "upvotes"
            ? { upvoteCount: -1, createdAt: -1 }
            : { createdAt: -1 },
      },
    ]);
    res.json({
      sort,
      stories: await serializeStories(stories, req.user._id),
      ...(await communityStats()),
    });
  } catch (err) {
    console.error("Feed failed:", err.message);
    res.status(500).json({ error: "Could not load stories" });
  }
});

app.post("/stories/:id/upvote", requireAuth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) {
      return res.status(404).json({ error: "Story not found" });
    }
    if (story.upvotes.some((id) => id.equals(req.user._id))) {
      return res.status(409).json({ error: "You already upvoted this story" });
    }

    story.upvotes.push(req.user._id);
    await story.save();

    const author = await User.findById(story.authorId);
    if (author) await syncUnlockedTitles(author);

    const title = author ? resolveDisplayTitle(author) : null;
    res.json({ story: serializeStory(story, req.user._id, title) });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(404).json({ error: "Story not found" });
    }
    console.error("Upvote failed:", err.message);
    res.status(500).json({ error: "Could not upvote story" });
  }
});

app.delete("/stories/:id", requireAuth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) {
      return res.status(404).json({ error: "Story not found" });
    }
    const owner = story.authorId.equals(req.user._id);
    if (!owner && !isAdmin(req.user)) {
      return res.status(403).json({ error: "You can only delete your own stories" });
    }

    const authorId = story.authorId;
    const storyPreview = String(story.content || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 180);
    const reason = String(req.body?.reason || "").trim().slice(0, 2000);

    if (!owner && isAdmin(req.user) && (!reason || reason.length < 2)) {
      return res.status(400).json({ error: "Add a reason for taking this story down" });
    }

    await story.deleteOne();

    if (owner) {
      const latest = await Story.findOne({ authorId: req.user._id }).sort({
        createdAt: -1,
      });
      req.user.lastPostDate = latest ? latest.createdAt : null;
      await req.user.save();
    } else {
      const author = await User.findById(authorId);
      if (author) {
        const latest = await Story.findOne({ authorId }).sort({ createdAt: -1 });
        author.lastPostDate = latest ? latest.createdAt : null;
        author.takedownNotices = [
          ...(author.takedownNotices || []),
          {
            id: `td_${randomBytes(6).toString("hex")}`,
            reason,
            storyPreview,
            createdAt: new Date(),
            seen: false,
          },
        ];
        await author.save();
      }
    }

    res.json({ ok: true, id: req.params.id });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(404).json({ error: "Story not found" });
    }
    console.error("Delete story failed:", err.message);
    res.status(500).json({ error: "Could not delete story" });
  }
});

app.post("/takedowns/:id/ack", requireAuth, async (req, res) => {
  try {
    const noticeId = String(req.params.id || "");
    const notice = (req.user.takedownNotices || []).find(
      (item) => item.id === noticeId
    );
    if (!notice) {
      return res.status(404).json({ error: "Notice not found" });
    }
    if (!notice.seen) {
      notice.seen = true;
      await req.user.save();
    }
    res.json({
      user: publicUser(req.user),
      ...(await authExtras(req.user)),
    });
  } catch (err) {
    console.error("Ack takedown failed:", err.message);
    res.status(500).json({ error: "Could not close notice" });
  }
});

app.get("/profile", requireAuth, async (req, res) => {
  try {
    await syncUnlockedTitles(req.user);
    const stories = await Story.find({ authorId: req.user._id }).sort({
      createdAt: -1,
    });
    const { totalUpvotes, postCount } = await authorTotals(req.user._id);
    res.json({
      user: publicUser(req.user),
      totalUpvotes,
      postCount,
      catalog: catalogForUser(req.user, totalUpvotes, postCount),
      stories: await serializeStories(stories, req.user._id),
    });
  } catch (err) {
    console.error("Profile failed:", err.message);
    res.status(500).json({ error: "Could not load profile" });
  }
});

app.put("/profile/title", requireAuth, async (req, res) => {
  try {
    await syncUnlockedTitles(req.user);
    const { titleId, showTitle } = req.body || {};

    if (typeof showTitle === "boolean") {
      req.user.showTitle = showTitle;
      if (!showTitle) {
        req.user.activeTitleId = null;
      }
    }

    if (titleId === null || titleId === "none" || titleId === "") {
      req.user.activeTitleId = null;
      req.user.showTitle = false;
    } else if (typeof titleId === "string") {
      const owned = ownedTitles(req.user);
      if (!owned.some((title) => title.id === titleId)) {
        return res.status(400).json({ error: "You do not own that title" });
      }
      req.user.activeTitleId = titleId;
      req.user.showTitle = true;
    }

    await req.user.save();
    const { totalUpvotes, postCount } = await authorTotals(req.user._id);
    res.json({
      user: publicUser(req.user),
      catalog: catalogForUser(req.user, totalUpvotes, postCount),
    });
  } catch (err) {
    console.error("Set title failed:", err.message);
    res.status(500).json({ error: "Could not update title" });
  }
});

app.post("/profile/gift/ack", requireAuth, async (req, res) => {
  try {
    const giftId = String(req.body?.giftId || "");
    if (!giftId) {
      return res.status(400).json({ error: "Missing gift id" });
    }
    let changed = false;
    for (const gift of req.user.giftedTitles || []) {
      if (gift.id === giftId && !gift.seen) {
        gift.seen = true;
        changed = true;
      }
    }
    if (changed) await req.user.save();
    res.json({ user: publicUser(req.user) });
  } catch (err) {
    console.error("Ack gift failed:", err.message);
    res.status(500).json({ error: "Could not acknowledge gift" });
  }
});

app.post("/admin/message", requireAuth, requireAdmin, async (req, res) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const body = String(req.body?.body || "").trim().slice(0, 2000);
    if (!username) {
      return res.status(400).json({ error: "Enter a valid username" });
    }
    if (!body || body.length < 2) {
      return res.status(400).json({ error: "Write a short message" });
    }

    const target = await User.findOne({ username });
    if (!target) {
      return res.status(404).json({ error: "User not found" });
    }
    if (target.isProxy) {
      return res.status(400).json({ error: "Cannot message proxy users" });
    }

    const note = {
      id: newMessageId(),
      body,
      from: ADMIN_DISPLAY_NAME,
      createdAt: new Date(),
      seen: false,
      reply: null,
      replyAt: null,
      replySeen: false,
    };
    target.adminNotes = [...(target.adminNotes || []), note];
    await target.save();

    res.json({
      ok: true,
      message: { id: note.id, username: target.username },
    });
  } catch (err) {
    console.error("Admin message failed:", err.message);
    res.status(500).json({ error: "Could not send message" });
  }
});

app.post("/messages/:id/respond", requireAuth, async (req, res) => {
  try {
    const messageId = String(req.params.id || "");
    const reply = String(req.body?.reply || "").trim().slice(0, 2000);
    const note = (req.user.adminNotes || []).find((item) => item.id === messageId);
    if (!note) {
      return res.status(404).json({ error: "Message not found" });
    }
    if (note.seen) {
      return res.json({
        user: publicUser(req.user),
        ...(await authExtras(req.user)),
      });
    }

    note.seen = true;
    if (reply) {
      note.reply = reply;
      note.replyAt = new Date();
      note.replySeen = false;
    }
    await req.user.save();

    res.json({
      user: publicUser(req.user),
      ...(await authExtras(req.user)),
    });
  } catch (err) {
    console.error("Respond to message failed:", err.message);
    res.status(500).json({ error: "Could not send reply" });
  }
});

app.post("/admin/messages/:id/ack-reply", requireAuth, requireAdmin, async (req, res) => {
  try {
    const messageId = String(req.params.id || "");
    const userId = String(req.body?.userId || "");
    const target = userId
      ? await User.findById(userId)
      : await User.findOne({ "adminNotes.id": messageId });
    if (!target) {
      return res.status(404).json({ error: "Reply not found" });
    }
    const note = (target.adminNotes || []).find((item) => item.id === messageId);
    if (!note) {
      return res.status(404).json({ error: "Reply not found" });
    }
    note.replySeen = true;
    await target.save();

    res.json({
      user: publicUser(req.user),
      ...(await authExtras(req.user)),
    });
  } catch (err) {
    console.error("Ack reply failed:", err.message);
    res.status(500).json({ error: "Could not close reply" });
  }
});

app.post("/admin/gift-title", requireAuth, requireAdmin, async (req, res) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const name = String(req.body?.name || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 24);
    if (!username) {
      return res.status(400).json({ error: "Enter a valid username" });
    }
    if (!name || !/^[A-Za-z0-9 _-]{2,24}$/.test(name)) {
      return res.status(400).json({
        error: "Title must be 2–24 letters, numbers, spaces, _ or -",
      });
    }

    const target = await User.findOne({ username });
    if (!target) {
      return res.status(404).json({ error: "User not found" });
    }
    if (target.isProxy) {
      return res.status(400).json({ error: "Cannot gift titles to proxy users" });
    }

    const gradient = randomGiftGradient();
    const gift = {
      id: newGiftId(),
      name,
      color: gradient[0],
      gradient,
      giftedBy: ADMIN_DISPLAY_NAME,
      giftedAt: new Date(),
      seen: false,
    };
    target.giftedTitles = [...(target.giftedTitles || []), gift];
    if (!target.activeTitleId && target.showTitle !== false) {
      target.activeTitleId = gift.id;
      target.showTitle = true;
    }
    await target.save();

    res.json({
      ok: true,
      gift: {
        id: gift.id,
        name: gift.name,
        kind: "gift",
        gradient: gift.gradient,
      },
      user: {
        username: target.username,
        titles: ownedTitles(target),
      },
    });
  } catch (err) {
    console.error("Gift title failed:", err.message);
    res.status(500).json({ error: "Could not gift title" });
  }
});

async function start() {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }
    await connectDb(process.env.MONGODB_URI);

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server listening on port ${PORT}`);
      startCommunity();
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

start();
