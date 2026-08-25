import "server-only";

export type SpeakerResolution =
  | { status: "resolved"; name: string }
  | { status: "ambiguous"; raw: string };

// Deterministic speaker -> roster-name resolution, per prompt.md Section 6.3.
// Kept out of the LLM prompt on purpose: name matching against a known
// roster is a rule-based lookup, not a judgment call, so it runs in code and
// Gemini receives the resolution (or "ambiguous") rather than raw
// speaker strings it would have to guess at.
//
// `speaker` is either an email address (Fireflies gives emails for
// authenticated participants) or a display name. `roster` is the full-name
// list for the specific project being matched against — a resolution is only
// valid if the matched name is actually on that project's roster.
export function resolveSpeaker(speaker: string, rosterNames: string[]): SpeakerResolution {
  const rosterByLower = new Map(rosterNames.map((n) => [n.toLowerCase(), n] as const));

  // 1. Email local part -> name, case-insensitive (abeer@scalepods.tech -> Abeer).
  const emailMatch = speaker.match(/^([^@]+)@/);
  if (emailMatch) {
    const localPart = emailMatch[1].toLowerCase();
    const match = rosterByLower.get(localPart);
    if (match) return { status: "resolved", name: match };
  }

  // 2. Display name first token (e.g. "Naveen K." -> Naveen).
  const firstToken = speaker.trim().split(/\s+/)[0]?.toLowerCase();
  if (firstToken) {
    const match = rosterByLower.get(firstToken);
    if (match) return { status: "resolved", name: match };
  }

  // 3. No confident match: never guess. Section 6.3 routes this to
  // pending_review_queue rather than assigning a wrong or placeholder name.
  return { status: "ambiguous", raw: speaker };
}
