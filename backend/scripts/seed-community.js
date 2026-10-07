import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { runCommunityTick } from "../src/community.js";

const backendDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(backendDir, "..");
dotenv.config({ path: join(backendDir, ".env") });

const credPath = join(root, "atlas-credentials.env");

function atlasUri() {
  if (!existsSync(credPath)) throw new Error("atlas-credentials.env missing");
  const text = readFileSync(credPath, "utf8");
  const match = text.match(/MONGODB_URI="?([^"\n]+)"?/);
  if (!match) throw new Error("MONGODB_URI missing");
  let uri = match[1].trim();
  if (uri.endsWith(".mongodb.net") || uri.endsWith(".mongodb.net/")) {
    uri = uri.replace(/\/?$/, "/voice");
  }
  if (!uri.includes("retryWrites")) {
    uri += uri.includes("?")
      ? "&retryWrites=true&w=majority"
      : "?retryWrites=true&w=majority";
  }
  return uri;
}

await mongoose.connect(atlasUri(), { dbName: "voice" });
console.log("Connected to Atlas db: voice");
await runCommunityTick(true);
await runCommunityTick(true);
const { Story } = await import("../src/models/Story.js");
const { User } = await import("../src/models/User.js");
const stories = await Story.countDocuments();
const proxies = await User.countDocuments({ isProxy: true });
console.log(`done. stories=${stories} proxies=${proxies}`);
await mongoose.disconnect();
