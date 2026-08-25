import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

const MODEL = "claude-opus-5";

// Client is constructed per-call (not module-scope) so a missing key
// surfaces as a caught rejection at the call site, not a page-wide crash —
// mirrors the prior Gemini client's pattern.
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing ANTHROPIC_API_KEY environment variable. Add it to .env.local (console.anthropic.com -> API keys). It must never be exposed to the browser."
    );
  }

  return new Anthropic({ apiKey });
}

// Plain-text generation for short, low-stakes output (the dashboard's
// project-summary feature). Low effort keeps cost/latency down for a task
// that's summarization, not judgment.
export async function generateText(prompt: string): Promise<string> {
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    output_config: { effort: "low" },
    messages: [{ role: "user", content: prompt }],
  });

  let text: string | undefined;
  for (const block of response.content) {
    if (block.type === "text") {
      text = block.text;
      break;
    }
  }

  if (!text || text.trim().length === 0) {
    throw new Error("Claude response contained no text.");
  }

  return text.trim();
}

// Structured-output call: Claude validates its own response against `schema`
// server-side via client.messages.parse(), so callers get a fully-typed,
// schema-valid object back instead of freeform text to parse — replaces the
// prior Gemini JSON-mode call. Left at the default (high) effort, since this
// backs the sync pipeline's transcript classification, where judgment
// quality matters most. The SDK retries 429/5xx automatically (default
// max_retries: 2), which also covers the transient "model overloaded"
// failures the prior Gemini integration had no retry for.
export async function generateStructured<T extends z.ZodTypeAny>(
  prompt: string,
  schema: T
): Promise<z.infer<T>> {
  const client = getClient();

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { format: zodOutputFormat(schema) },
    messages: [{ role: "user", content: prompt }],
  });

  if (response.parsed_output === null) {
    throw new Error("Claude structured response failed to parse against the schema.");
  }

  return response.parsed_output;
}
