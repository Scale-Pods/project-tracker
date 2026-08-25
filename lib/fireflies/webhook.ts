import "server-only";
import crypto from "node:crypto";

// Fireflies Webhooks V2 payload shape (docs.fireflies.ai/graphql-api/webhooks-v2):
// { event, timestamp, meeting_id, client_reference_id? }. "meeting.transcribed"
// is the event that means a transcript is ready to fetch — that's the only one
// this pipeline acts on. "meeting.summarized" fires afterward for the same
// meeting (summary only, no new attribution data) and "meeting.bot_joined" is
// irrelevant here, so both are accepted with a 200 no-op.
export const TARGET_WEBHOOK_EVENT = "meeting.transcribed";

export type FirefliesWebhookPayload = {
  event: string;
  timestamp: number;
  meeting_id: string;
  client_reference_id?: string;
};

// Verifies the `X-Hub-Signature` header ("sha256=<hex hmac>") against the raw
// request body, per docs.fireflies.ai/graphql-api/webhooks-v2. Must run on
// the raw body string — never on a re-serialized JSON.parse'd object, since
// key ordering/whitespace differences would break the HMAC comparison.
export function verifyFirefliesSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.FIREFLIES_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error(
      "Missing FIREFLIES_WEBHOOK_SECRET environment variable. Add it to .env.local and to the secret configured in Fireflies Settings -> Integrations -> Webhooks."
    );
  }

  if (!signatureHeader) return false;

  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");

  const provided = Buffer.from(signatureHeader);
  const expectedBuffer = Buffer.from(expected);

  if (provided.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(provided, expectedBuffer);
}

export function parseFirefliesWebhookPayload(rawBody: string): FirefliesWebhookPayload {
  const parsed = JSON.parse(rawBody);

  if (typeof parsed.event !== "string" || typeof parsed.meeting_id !== "string") {
    throw new Error("Malformed Fireflies webhook payload: missing event or meeting_id.");
  }

  return parsed as FirefliesWebhookPayload;
}
