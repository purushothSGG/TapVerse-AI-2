// netlify/functions/analyze.ts
import type { Handler } from "@netlify/functions";
import OpenAI  from "openai";
import crypto from "crypto";

// instantiate OpenAI client
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// simple in-memory cache
const cache = new Map<string, { message: string; ts: number }>();
const CACHE_TTL_MS = 1000 * 60 * 10;

function statsHash(stats: any) {
  return crypto.createHash("sha256").update(JSON.stringify(stats)).digest("hex");
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let body: any = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const stats = body.stats;
  if (!stats) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing stats" }) };
  }

  // caching by stats hash
  const key = statsHash(stats);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: cached.message, cached: true }),
    };
  }

  // Build the typed messages array for the chat completion
const messages = [
  {
    role: "system",
    content:
      `You are a loud, dramatic, Tamil movie-style narrator who speaks only Tamil. ` +
      `Write a single punchy one-line verdict in Tamil (max ~25 words). Keep it family-friendly and humorous.`
  },
  {
    role: "user",
    content: `Gameplay stats: ${JSON.stringify({ score: 12, durationMs: 5000, highScore: 5, dueToWrongTap: true })}\nWrite a one-line verdict in Tamil.`
  },
  {
    role: "assistant",
    content: "karuppu vella ku vithiyasam koodava teriyathu mutta payale 🔥"
  },

  {
    role: "user",
    content: `Gameplay stats: ${JSON.stringify({ score: 20, durationMs: 10000, highScore: 20, dueToWrongTap: true })}\nWrite a one-line verdict in Tamil.`
  },
  {
    role: "assistant",
    content: "hmm , ok aana ne adhuku sar pattu varamaata! 💥"
  },
   {
    role: "user",
    content: `Gameplay stats: ${JSON.stringify({ score: 30, durationMs: 15000, highScore: 20, dueToWrongTap: true })}\nWrite a one-line verdict in Tamil.`
  },
  {
    role: "assistant",
    content: "vera level thala !!"
  },
  {
    role: "user",
    content: `Gameplay stats: ${JSON.stringify(stats)}\nWrite a single-sentence, punchy Tamil verdict.`
  }
];

  try {
    const completion = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: messages as any,   // <-- cast here
  max_tokens: 60,
  temperature: 1.0,
  top_p: 0.95,
});
    // Extract the assistant text safely (depends on response shape)
    const text = completion?.choices?.[0]?.message?.content ?? "வா சுகமாக விளையாடினாய்!";

    // cache result
    cache.set(key, { message: text, ts: Date.now() });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: text }),
    };
  } catch (err: any) {
    console.error("OpenAI error", err?.message ?? err);
    // if OpenAI returns structured error info, include safe message
    const errorMessage = err?.message ?? "AI request failed";
    return {
      statusCode: 500,
      body: JSON.stringify({ error: errorMessage }),
    };
  }
};
