import Groq from "groq-sdk";

export function groqApiKey() {
  return (process.env.GROQ_API_KEY || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, "");
}

const FRIENDLY_MODERATION_ERROR =
  "Story check is busy right now. Please try again in a little while.";

function parseModeration(text) {
  try {
    const match = String(text || "").match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : "{}");
    if (typeof parsed.approved !== "boolean") {
      return null;
    }
    return {
      approved: parsed.approved === true,
      reason: String(parsed.reason || (parsed.approved ? "Approved" : "Rejected")),
    };
  } catch {
    return null;
  }
}

async function askModerator(groq, content, useJsonFormat) {
  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-20b",
    temperature: 0,
    ...(useJsonFormat ? { response_format: { type: "json_object" } } : {}),
    messages: [
      {
        role: "system",
        content:
          'You are a content moderator for a public storytelling app. Decide if a story is safe to publish. Reject hate, harassment, graphic violence, sexual content, self-harm encouragement, spam, scams, and illegal activity. Respond with ONLY this JSON object and nothing else: {"approved":true,"reason":"short explanation"} or {"approved":false,"reason":"short explanation"}.',
      },
      {
        role: "user",
        content,
      },
    ],
  });

  return parseModeration(completion.choices[0]?.message?.content);
}

export async function moderateStory(content) {
  const apiKey = groqApiKey();
  if (!apiKey) {
    const err = new Error("GROQ_API_KEY is not configured");
    err.status = 500;
    throw err;
  }

  const groq = new Groq({ apiKey });
  const toModerate =
    content.length > 12000 ? `${content.slice(0, 12000)}\n\n[truncated for moderation]` : content;

  try {
    let result = null;
    try {
      result = await askModerator(groq, toModerate, true);
    } catch (firstErr) {
      console.error(
        "Groq moderation JSON mode failed:",
        firstErr?.error?.message || firstErr.message
      );
    }

    if (!result) {
      result = await askModerator(groq, toModerate, false);
    }

    if (!result) {
      const err = new Error(FRIENDLY_MODERATION_ERROR);
      err.status = 502;
      err.public = true;
      throw err;
    }

    return result;
  } catch (err) {
    if (err.public || err.message === "GROQ_API_KEY is not configured") {
      throw err;
    }
    const detail = err?.error?.message || err.message || "Groq request failed";
    console.error("Groq moderation failed:", detail);
    const wrapped = new Error(FRIENDLY_MODERATION_ERROR);
    wrapped.status = 502;
    wrapped.public = true;
    throw wrapped;
  }
}
