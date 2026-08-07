type OrbVariant = "primary" | "deep" | "highlight";
type OrbSize = "sm" | "md" | "lg" | "xl";

const VARIANT_CLASS: Record<OrbVariant, string> = {
  primary: "bg-orb-primary",
  deep: "bg-orb-deep",
  highlight: "bg-orb-highlight",
};

const SIZE_CLASS: Record<OrbSize, string> = {
  sm: "bg-orb-sm",
  md: "bg-orb-md",
  lg: "bg-orb-lg",
  xl: "bg-orb-xl",
};

/**
 * A single blurred, absolutely-positioned glow — the reusable primitive
 * behind BackgroundGradient. Position it with a Tailwind inset utility via
 * `className` (e.g. "top-[10%] -left-[8%]"); color, size, blur, and opacity
 * all come from the `.bg-orb*` classes in globals.css, so retuning the
 * palette only means editing the CSS variables there, not this component.
 */
export function Orb({
  variant = "primary",
  size = "md",
  className = "",
  duration = "18s",
  delay = "0s",
}: {
  variant?: OrbVariant;
  size?: OrbSize;
  className?: string;
  /** CSS duration string, e.g. "18s". Vary per-instance so orbs don't pulse in sync. */
  duration?: string;
  /** CSS delay string; negative values (e.g. "-6s") start the orb mid-cycle. */
  delay?: string;
}) {
  return (
    <div
      className={`bg-orb ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
      style={{ animationDuration: duration, animationDelay: delay }}
    />
  );
}
