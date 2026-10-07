import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import mongoose from "mongoose";
import { User } from "../src/models/User.js";
import { syncUnlockedTitles } from "../src/userStats.js";
import { ADMIN_EMAIL, OWNER_TITLE_ID } from "../src/titles.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
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
const user = await User.findOne({ email: ADMIN_EMAIL });
if (!user) {
  console.error(`No user with email ${ADMIN_EMAIL}`);
  process.exit(1);
}

await syncUnlockedTitles(user);
user.activeTitleId = OWNER_TITLE_ID;
user.showTitle = true;
await user.save();

console.log(
  JSON.stringify(
    {
      email: user.email,
      username: user.username,
      activeTitleId: user.activeTitleId,
      unlockedTitleIds: user.unlockedTitleIds,
      giftedTitles: user.giftedTitles,
    },
    null,
    2
  )
);
await mongoose.disconnect();
