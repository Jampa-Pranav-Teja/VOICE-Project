import { randomBytes } from "crypto";
import { User } from "./models/User.js";
import { ADMIN_DISPLAY_NAME, isAdmin } from "./titles.js";

export function newMessageId() {
  return `msg_${randomBytes(6).toString("hex")}`;
}

export function pendingMessage(user) {
  if (isAdmin(user)) return null;
  const note = (user.adminNotes || []).find((item) => !item.seen);
  if (!note) return null;
  return {
    id: note.id,
    body: note.body,
    from: note.from || ADMIN_DISPLAY_NAME,
  };
}

export function pendingTakedown(user) {
  if (isAdmin(user)) return null;
  const notice = (user.takedownNotices || []).find((item) => !item.seen);
  if (!notice) return null;
  return {
    id: notice.id,
    reason: notice.reason,
    storyPreview: notice.storyPreview || "",
  };
}

export async function pendingReplyForAdmin(adminUser) {
  if (!isAdmin(adminUser)) return null;
  const user = await User.findOne({
    adminNotes: {
      $elemMatch: {
        reply: { $nin: [null, ""] },
        replySeen: false,
      },
    },
  });
  if (!user) return null;
  const note = (user.adminNotes || []).find(
    (item) => item.reply && !item.replySeen
  );
  if (!note) return null;
  return {
    id: note.id,
    userId: String(user._id),
    username: user.username,
    original: note.body,
    reply: note.reply,
  };
}
