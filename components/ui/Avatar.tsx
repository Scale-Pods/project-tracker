import { initialsFor } from "@/lib/format";

// Alpha is high enough (55-65%) to read as a genuinely colored chip rather
// than a barely-tinted circle, with text picked per-tone for contrast: dark
// text on the bright status hues, white on the dark accent-primary. The glow
// shadow is what actually separates the avatar from the card behind it.
const AVATAR_TONES = [
  "bg-accent-primary/60 text-white shadow-[0_0_10px_-2px_var(--color-accent-primary)]",
  "bg-status-good/65 text-[#04140f] shadow-[0_0_10px_-2px_var(--color-status-good)]",
  "bg-status-warn/65 text-[#1f1300] shadow-[0_0_10px_-2px_var(--color-status-warn)]",
  "bg-status-bad/65 text-[#1a0505] shadow-[0_0_10px_-2px_var(--color-status-bad)]",
];

export function Avatar({
  name,
  index,
  size = "sm",
}: {
  name: string;
  index: number;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "md" ? "h-10 w-10 text-sm" : "h-7 w-7 text-[10px]";
  return (
    <span
      title={name}
      className={`flex shrink-0 items-center justify-center rounded-full border-2 border-surface-card font-semibold ${sizeClass} ${AVATAR_TONES[index % AVATAR_TONES.length]}`}
    >
      {initialsFor(name)}
    </span>
  );
}
