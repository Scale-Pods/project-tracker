import { PAYOUT_ROLE_LABEL } from "@/lib/validation";
import { PHASE_LABEL, type BandwidthStatus, type ProjectPhase } from "@/lib/types";

type BadgeTone = "good" | "warn" | "bad" | "accent" | "neutral" | "muted";

// Background stays low-alpha so bright tone-colored text keeps strong
// contrast (per the "brighter text on a dark fill, never the inverse" rule);
// the pop instead comes from a more saturated border plus an outer glow —
// the badge reads as a small lit chip against the dark surface rather than
// a flat sticker.
const TONE_CLASSES: Record<BadgeTone, string> = {
  good: "bg-status-good/20 text-status-good border-status-good/60 shadow-[0_0_16px_-6px_var(--color-status-good)]",
  warn: "bg-status-warn/20 text-status-warn border-status-warn/60 shadow-[0_0_16px_-6px_var(--color-status-warn)]",
  bad: "bg-status-bad/20 text-status-bad border-status-bad/60 shadow-[0_0_16px_-6px_var(--color-status-bad)]",
  accent:
    "bg-accent-primary/30 text-[#a9adff] border-accent-primary/70 shadow-[0_0_16px_-6px_var(--color-accent-primary)]",
  neutral: "bg-surface-elevated text-text-primary border-border-subtle",
  muted: "bg-transparent text-text-secondary border-border-subtle",
};

export function Badge({
  tone = "neutral",
  children,
  dotted = false,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  dotted?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-[0.01em] whitespace-nowrap ${TONE_CLASSES[tone]} ${dotted ? "border-dashed" : ""}`}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, BadgeTone> = {
  "On Track": "good",
  "At Risk": "warn",
  Delayed: "bad",
  Completed: "good",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return (
    <Badge tone={tone}>
      <span
        className="h-1.5 w-1.5 rounded-full shadow-[0_0_6px_1px_currentColor]"
        style={{ backgroundColor: "currentColor" }}
        aria-hidden="true"
      />
      {status}
    </Badge>
  );
}

const PRIORITY_TONE: Record<string, BadgeTone> = {
  High: "accent",
  Medium: "neutral",
  Low: "muted",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return <Badge tone={PRIORITY_TONE[priority] ?? "neutral"}>{priority}</Badge>;
}

export function StageBadge({ stage }: { stage: string }) {
  return <Badge tone="neutral">{stage}</Badge>;
}

const PAYOUT_ROLE_TONE: Record<string, BadgeTone> = {
  Owner: "accent",
  Support: "neutral",
};

export function PayoutRoleBadge({ role }: { role: string }) {
  return <Badge tone={PAYOUT_ROLE_TONE[role] ?? "neutral"}>{PAYOUT_ROLE_LABEL[role] ?? role}</Badge>;
}

const SIDE_TONE: Record<string, BadgeTone> = {
  client: "warn",
  internal: "accent",
};

export function SideBadge({ side }: { side: string }) {
  return <Badge tone={SIDE_TONE[side.toLowerCase()] ?? "neutral"}>{side}</Badge>;
}

const PHASE_TONE: Record<ProjectPhase, BadgeTone> = {
  development: "accent",
  testing_support: "warn",
};

/** Which of the two onboarding timelines a blocker or pending task belongs to. */
export function PhaseBadge({ phase }: { phase: string }) {
  const key = phase as ProjectPhase;
  return <Badge tone={PHASE_TONE[key] ?? "neutral"}>{PHASE_LABEL[key] ?? phase}</Badge>;
}

export function SourceBadge({ source }: { source: string }) {
  const isFireflies = source === "fireflies";
  return <Badge tone={isFireflies ? "accent" : "muted"}>{isFireflies ? "Fireflies" : "Manual"}</Badge>;
}

const BANDWIDTH_TONE: Record<BandwidthStatus, BadgeTone> = {
  overloaded: "bad",
  balanced: "good",
  light: "accent",
};

const BANDWIDTH_LABEL: Record<BandwidthStatus, string> = {
  overloaded: "Tight bandwidth",
  balanced: "Balanced",
  light: "Light load",
};

export function BandwidthBadge({ status }: { status: BandwidthStatus }) {
  return <Badge tone={BANDWIDTH_TONE[status]}>{BANDWIDTH_LABEL[status]}</Badge>;
}

const shortDateFormatter = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" });

/** Cross-project weekly signal: whether this person has cleared everything
 * they own, everywhere, as of this week's Friday — i.e. Saturday eligible. */
export function SaturdayOffBadge({
  eligible,
  openCount,
  saturday,
}: {
  eligible: boolean;
  openCount: number;
  saturday: Date;
}) {
  const dateLabel = shortDateFormatter.format(saturday);
  return (
    <Badge tone={eligible ? "good" : "muted"}>
      {eligible
        ? `Eligible · ${dateLabel}`
        : `${openCount} pending · ${dateLabel}`}
    </Badge>
  );
}

/** Small dashed-outline flag for any row carrying an AI confidence tag. */
export function UnverifiedFlag({ className = "" }: { className?: string }) {
  return (
    <span
      title="Contains at least one AI update below confidence threshold."
      aria-label="Unverified AI update"
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dashed border-text-secondary/50 text-[10px] text-text-secondary ${className}`}
    >
      ?
    </span>
  );
}
