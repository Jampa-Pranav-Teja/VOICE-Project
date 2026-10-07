import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { User } from "./models/User.js";
import {
  isAdmin,
  ownedTitles,
  pendingGift,
  resolveDisplayTitle,
} from "./titles.js";
import { pendingMessage } from "./messages.js";

export const googleClientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
const googleClient = new OAuth2Client(googleClientId);

export function publicUser(user) {
  const title = resolveDisplayTitle(user);
  return {
    id: String(user._id),
    email: user.email,
    username: user.username || null,
    isAdmin: isAdmin(user),
    showTitle: user.showTitle !== false,
    activeTitleId: user.activeTitleId || null,
    title,
    titles: ownedTitles(user),
    pendingGift: pendingGift(user),
    pendingMessage: pendingMessage(user),
  };
}

export function signToken(user) {
  return jwt.sign({ userId: String(user._id) }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
}

export async function verifyGoogleToken(credential) {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: googleClientId,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error("Invalid Google token");
  }
  return payload;
}

export async function verifyGoogleAccessToken(accessToken) {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Invalid Google access token");
  const data = await res.json();
  if (!data.sub || !data.email) throw new Error("Invalid Google profile");
  return { sub: data.sub, email: data.email };
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return res.status(401).json({ error: "Sign in required" });
  }

  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireUsername(req, res, next) {
  if (!req.user.username) {
    return res.status(403).json({ error: "Set a username before posting" });
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}

export function normalizeUsername(raw) {
  const username = String(raw || "").trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return null;
  return username;
}

export function postedToday(lastPostDate, now = new Date()) {
  if (!lastPostDate) return false;
  return (
    lastPostDate.getUTCFullYear() === now.getUTCFullYear() &&
    lastPostDate.getUTCMonth() === now.getUTCMonth() &&
    lastPostDate.getUTCDate() === now.getUTCDate()
  );
}
