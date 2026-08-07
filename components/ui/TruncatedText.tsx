"use client";

import { useState } from "react";

// Long scope/notes text (Section 13's edge case) truncates rather than
// breaking card/section layout, with a "Show more" toggle.
export function TruncatedText({ text, limit = 280 }: { text: string; limit?: number }) {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;

  const isLong = text.length > limit;
  const shown = expanded || !isLong ? text : `${text.slice(0, limit).trimEnd()}…`;

  return (
    <div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-text-secondary">{shown}</p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-xs font-medium text-accent-primary hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
