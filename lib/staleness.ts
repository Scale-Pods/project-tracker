import { daysBetween } from "@/lib/format";

// Whether an item on the project detail page has gone quiet long enough that it
// should drop out of view — the assumption being it was finished / resolved and
// simply stopped coming up in meetings, which is how the Fireflies sync
// pipeline's items usually end (it rarely records an explicit done/resolved).
//
// This only ever HIDES from the detail read (lib/queries.ts getProjectDetail).
// Rows stay in the database and the audit trail; the Development Progress score
// (lib/progress/) keeps reading the full history, where its own STALE_DAYS logic
// already counts these as resolved — so the shorter list and the score agree.

/** Days without a mention after which an untouched open item is treated as
 * quietly settled. Exported so a change is a one-line reviewable diff (same
 * rationale as the DPI constants in lib/progress/compute.ts). Deliberately
 * shorter than the DPI's STALE_DAYS (14): the score should be slow to call
 * something done, the list can tidy sooner. */
export const QUIET_SETTLE_DAYS = 10;

/** True when an item last discussed on `lastMentionedDate` should be hidden:
 * it's been more than QUIET_SETTLE_DAYS since, AND the project has held at least
 * one processed meeting since then (so a plain gap in meeting cadence never
 * makes items disappear). All dates are plain "YYYY-MM-DD" strings. */
export function isQuietlySettled(
  lastMentionedDate: string,
  projectMeetingDates: string[],
  nowKey: string
): boolean {
  if (daysBetween(lastMentionedDate, nowKey) <= QUIET_SETTLE_DAYS) return false;
  return projectMeetingDates.some((d) => d > lastMentionedDate && d <= nowKey);
}
