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
  requireAuth,
  requireUsername,
  signToken,
  verifyGoogleAccessToken,
  verifyGoogleToken,
} from "./auth.js";
import { groqApiKey, moderateStory } from "./moderate.js";
import { communityStats, startCommunity } from "./community.js";

const app = express();
const PORT = process.env.PORT || 4000;

function serializeStory(story, userId) {
  const upvotes = (story.upvotes || []).map((id) => String(id));
  return {
    id: String(story._id),
    authorUsername: story.authorUsername,
    content: story.content,
    upvoteCount: upvotes.length,
    upvoted: userId ? upvotes.includes(String(userId)) : false,
    createdAt: story.createdAt,
  };
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
    }

    res.json({
      token: signToken(user),
      user: publicUser(user),
      needsUsername: !user.username,
      ...(await communityStats()),
    });
  } catch (err) {
    console.error("Google auth failed:", err.message);
    res.status(401).json({ error: "Google sign-in failed" });
  }
});

app.get("/auth/me", requireAuth, async (req, res) => {
  res.json({
    user: publicUser(req.user),
    needsUsername: !req.user.username,
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

    res.status(201).json({ story: serializeStory(story, req.user._id) });
  } catch (err) {
    console.error("Create story failed:", err.message);
    console.error(err);
    if (err.message === "GROQ_API_KEY is not configured") {
      return res.status(500).json({ error: err.message });
    }
    if (err.status === 502 || String(err.message).startsWith("Moderation failed")) {
      return res.status(502).json({
        error: err.message || "Story moderation failed. Check GROQ_API_KEY on Railway.",
      });
    }
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({
      error: "Could not publish story",
      reason: err.message,
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
      stories: stories.map((story) => serializeStory(story, req.user._id)),
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
    res.json({ story: serializeStory(story, req.user._id) });
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
    if (!story.authorId.equals(req.user._id)) {
      return res.status(403).json({ error: "You can only delete your own stories" });
    }

    await story.deleteOne();

    const latest = await Story.findOne({ authorId: req.user._id }).sort({
      createdAt: -1,
    });
    req.user.lastPostDate = latest ? latest.createdAt : null;
    await req.user.save();

    res.json({ ok: true, id: req.params.id });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(404).json({ error: "Story not found" });
    }
    console.error("Delete story failed:", err.message);
    res.status(500).json({ error: "Could not delete story" });
  }
});

app.get("/profile", requireAuth, async (req, res) => {
  try {
    const stories = await Story.find({ authorId: req.user._id }).sort({
      createdAt: -1,
    });
    const totalUpvotes = stories.reduce(
      (sum, story) => sum + story.upvotes.length,
      0
    );
    res.json({
      user: publicUser(req.user),
      totalUpvotes,
      stories: stories.map((story) => serializeStory(story, req.user._id)),
    });
  } catch (err) {
    console.error("Profile failed:", err.message);
    res.status(500).json({ error: "Could not load profile" });
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
