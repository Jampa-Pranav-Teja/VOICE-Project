import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import mongoose from "mongoose";
import { User } from "../src/models/User.js";
import { Story } from "../src/models/Story.js";
import { PROXY_USERS } from "../src/proxies.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const credPath = join(root, "atlas-credentials.env");

function atlasUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  if (!existsSync(credPath)) {
    throw new Error("Set MONGODB_URI or add atlas-credentials.env");
  }
  const text = readFileSync(credPath, "utf8");
  const match = text.match(/MONGODB_URI="?([^"\n]+)"?/);
  if (!match) throw new Error("MONGODB_URI missing from atlas-credentials.env");
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

async function findProxy(person) {
  const ids = [`proxy:${person.username}`];
  if (person.previous) ids.push(`proxy:${person.previous}`);
  return (
    (await User.findOne({ googleId: { $in: ids } })) ||
    (await User.findOne({
      isProxy: true,
      username: { $in: [person.username, person.previous].filter(Boolean) },
    }))
  );
}

async function seed() {
  const uri = atlasUri();
  await mongoose.connect(uri, { dbName: "voice" });
  console.log("Connected to Atlas db: voice");

  const taken = new Set(
    (
      await User.find(
        { username: { $in: PROXY_USERS.map((p) => p.username) } },
        { username: 1, isProxy: 1, googleId: 1 }
      ).lean()
    )
      .filter((user) => !user.isProxy && !String(user.googleId || "").startsWith("proxy:"))
      .map((user) => user.username)
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const person of PROXY_USERS) {
    if (taken.has(person.username)) {
      console.log(`skip ${person.username}: already a real user`);
      skipped += 1;
      continue;
    }

    const googleId = `proxy:${person.username}`;
    let user = await findProxy(person);

    if (!user) {
      user = await User.create({
        googleId,
        email: person.email,
        username: person.username,
        isProxy: true,
        lastPostDate: null,
      });
      created += 1;
      console.log(`created ${person.username}`);
      continue;
    }

    const oldUsername = user.username;
    user.googleId = googleId;
    user.email = person.email;
    user.username = person.username;
    user.isProxy = true;
    await user.save();
    if (oldUsername && oldUsername !== person.username) {
      await Story.updateMany(
        { authorId: user._id },
        { $set: { authorUsername: person.username } }
      );
      console.log(`renamed ${oldUsername} -> ${person.username}`);
    } else {
      console.log(`updated ${person.username}`);
    }
    updated += 1;
  }

  const total = await User.countDocuments();
  const proxies = await User.countDocuments({ isProxy: true });
  console.log(`created=${created} updated=${updated} skipped=${skipped}`);
  console.log(`totals: users=${total} proxies=${proxies}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
