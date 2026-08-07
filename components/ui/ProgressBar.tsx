const TONE_CLASSES: Record<"accent" | "good" | "warn" | "bad", string> = {
  accent: "bg-accent-primary",
  good: "bg-status-good",
  warn: "bg-status-warn",
  bad: "bg-status-bad",
};

export function ProgressBar({
  value,
  tone = "accent",
  label,
}: {
  value: number;
  tone?: "accent" | "good" | "warn" | "bad";
  label?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className="w-full">
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`h-full rounded-full animate-fill ${TONE_CLASSES[tone]}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
