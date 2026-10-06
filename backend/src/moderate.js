import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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
  if (!process.env.GROQ_API_KEY) {
    const err = new Error("GROQ_API_KEY is not configured");
    err.status = 500;
    throw err;
  }

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
        content,
      },
    ],
  });

  return parseModeration(completion.choices[0]?.message?.content);
}
