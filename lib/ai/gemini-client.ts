import "server-only";

const model = process.env.GEMINI_MODEL || "gemini-flash-latest";

// Raw REST call rather than the SDK, to avoid adding a dependency for a
// single request/response call shape. The missing-key check lives inside
// the function (not at module scope) so a misconfigured key surfaces as a
// caught rejection in getProjectSummary's try/catch, not a page-wide crash.
export async function generateText(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY environment variable. Add it to .env.local (Google AI Studio -> API keys). It must never be exposed to the browser."
    );
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("Gemini response contained no text.");
  }

  return text.trim();
}
