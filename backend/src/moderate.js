import Groq from "groq-sdk";

function groqApiKey() {
  return (process.env.GROQ_API_KEY || "").trim().replace(/^["']|["']$/g, "");
}

function parseModeration(text) {
  try {
    const match = String(text || "").match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : "{}");
    return {
      approved: parsed.approved === true,
      reason: String(parsed.reason || (parsed.approved ? "Approved" : "Rejected")),
    };
  } catch {
    return { approved: false, reason: "Moderation returned an invalid response" };
  }
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
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'You are a strict content moderator for a public anonymous storytelling app. Decide whether a story is safe to publish. Reject hate, harassment, violence, sexual content, self-harm, spam, scams, and illegal activity. Reply with JSON only in this exact shape: {"approved": true or false, "reason": "short explanation"}.',
        },
        {
          role: "user",
          content: toModerate,
        },
      ],
    });

    return parseModeration(completion.choices[0]?.message?.content);
  } catch (err) {
    const detail = err?.error?.message || err.message || "Groq request failed";
    console.error("Groq moderation failed:", detail);
    const wrapped = new Error(`Moderation failed: ${detail}`);
    wrapped.status = 502;
    throw wrapped;
  }
}
