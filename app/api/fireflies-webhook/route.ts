import { NextRequest, NextResponse } from "next/server";
import {
  TARGET_WEBHOOK_EVENT,
  parseFirefliesWebhookPayload,
  verifyFirefliesSignature,
} from "@/lib/fireflies/webhook";
import { processTranscript } from "@/lib/sync/process-transcript";

export const runtime = "nodejs";
export const maxDuration = 300;

// Receives Fireflies' "meeting.transcribed" webhook and runs the full sync
// pipeline synchronously. Always returns 200 once the signature is verified
// and the payload is well-formed — a pipeline failure is logged to
// sync_runs and retried by the next cron pass, not surfaced as a webhook
// error, since repeated non-2xx responses risk Fireflies disabling the
// webhook entirely.
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature");

  let verified: boolean;
  try {
    verified = verifyFirefliesSignature(rawBody, signature);
  } catch (err) {
    console.error("fireflies-webhook: signature verification misconfigured", err);
    return NextResponse.json({ error: "server misconfiguration" }, { status: 500 });
  }

  if (!verified) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload;
  try {
    payload = parseFirefliesWebhookPayload(rawBody);
  } catch (err) {
    console.error("fireflies-webhook: malformed payload", err);
    return NextResponse.json({ error: "malformed payload" }, { status: 400 });
  }

  if (payload.event !== TARGET_WEBHOOK_EVENT) {
    return NextResponse.json({ status: "ignored", event: payload.event });
  }

  const result = await processTranscript(payload.meeting_id, { trigger: "webhook" });

  if (result.status === "failed") {
    console.error(`fireflies-webhook: processing failed for ${payload.meeting_id}: ${result.error}`);
  }

  return NextResponse.json({ status: "ok", result });
}
