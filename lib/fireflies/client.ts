import "server-only";

const FIREFLIES_API_URL = "https://api.fireflies.ai/graphql";

export type FirefliesSentence = {
  index: number;
  speaker_name: string | null;
  speaker_id: string | null;
  text: string;
  start_time: number;
  end_time: number;
};

export type FirefliesMeetingSummary = {
  overview: string | null;
  bullet_gist: string | null;
  action_items: string | null;
  outline: string | null;
  keywords: string[] | null;
};

export type FirefliesMeetingDetails = {
  id: string;
  title: string;
  dateString: string;
  organizer_email: string | null;
  participants: string[];
  sentences: FirefliesSentence[];
  summary: FirefliesMeetingSummary | null;
};

export type FirefliesMeetingListItem = {
  id: string;
  title: string;
  dateString: string;
  organizer_email: string | null;
  participants: string[];
};

// Raw GraphQL call, no SDK dependency — mirrors the fetch pattern already
// used in lib/ai/claude-client.ts. Key check lives inside each call so a
// missing key surfaces as a caught rejection in the sync pipeline, not a
// module-load crash.
async function firefliesRequest<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const apiKey = process.env.FIREFLIES_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing FIREFLIES_API_KEY environment variable. Add it to .env.local (Fireflies Settings -> Developer Settings -> API key). It must never be exposed to the browser."
    );
  }

  const res = await fetch(FIREFLIES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Fireflies API request failed (${res.status}): ${body}`);
  }

  const data = await res.json();

  if (data.errors) {
    throw new Error(`Fireflies API returned errors: ${JSON.stringify(data.errors)}`);
  }

  return data.data as T;
}

// Lightweight listing for the cron reconciliation pass — replaces the
// "Search Meetings" Fireflies MCP tool. Callers diff the returned ids
// against processed_transcripts to find unprocessed meetings. Bounded by
// `limit` (the cron route caps this at the last few meetings, not an
// unbounded date window) and sorted newest-first client-side, since the
// API's own default ordering isn't documented as guaranteed. `title`, when
// given, scopes the search to meetings with that exact title — used to keep
// the cron pass in sync with a webhook that's itself filtered to one
// recurring meeting, rather than reconciling every meeting on the account.
export async function searchMeetings(
  limit: number,
  title?: string
): Promise<FirefliesMeetingListItem[]> {
  const query = `
    query Transcripts($limit: Int, $title: String) {
      transcripts(limit: $limit, title: $title) {
        id
        title
        dateString
        organizer_email
        participants
      }
    }
  `;

  const data = await firefliesRequest<{ transcripts: FirefliesMeetingListItem[] }>(query, {
    limit,
    title: title ?? null,
  });

  return (data.transcripts ?? [])
    .slice()
    .sort((a, b) => new Date(b.dateString).getTime() - new Date(a.dateString).getTime())
    .slice(0, limit);
}

// Full transcript with per-sentence speaker attribution — replaces the
// "Get Meeting Details" MCP tool. This is the only source ever used for
// extraction; summaries drop attribution and must never substitute for this.
export async function getMeetingDetails(transcriptId: string): Promise<FirefliesMeetingDetails> {
  const query = `
    query Transcript($id: String!) {
      transcript(id: $id) {
        id
        title
        dateString
        organizer_email
        participants
        sentences {
          index
          speaker_name
          speaker_id
          text
          start_time
          end_time
        }
      }
    }
  `;

  const data = await firefliesRequest<{ transcript: FirefliesMeetingDetails | null }>(query, {
    id: transcriptId,
  });

  if (!data.transcript) {
    throw new Error(`Fireflies transcript not found: ${transcriptId}`);
  }

  return data.transcript;
}

// Orientation-only summary — replaces "Get Meeting Summary". Used solely to
// help Claude orient on a long transcript; never as the sole extraction
// source (it drops speaker attribution).
export async function getMeetingSummary(transcriptId: string): Promise<FirefliesMeetingSummary | null> {
  const query = `
    query Transcript($id: String!) {
      transcript(id: $id) {
        summary {
          overview
          bullet_gist
          action_items
          outline
          keywords
        }
      }
    }
  `;

  const data = await firefliesRequest<{ transcript: { summary: FirefliesMeetingSummary | null } | null }>(
    query,
    { id: transcriptId }
  );

  return data.transcript?.summary ?? null;
}
