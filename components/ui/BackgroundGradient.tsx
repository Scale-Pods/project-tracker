import { Orb } from "@/components/ui/Orb";

/**
 * App-wide ambient background: a radial mesh glow plus a small, fixed set of
 * large blurred orbs (cheaper to animate than many small ones), a faint
 * noise pass, and a vignette. Entirely decorative — fixed, behind all
 * content, non-interactive. Mount once, near the root layout.
 */
export function BackgroundGradient() {
  return (
    <div className="bg-ambient" aria-hidden="true">
      <div className="bg-mesh" />

      <Orb variant="deep" size="xl" className="-top-[22%] -left-[18%]" duration="24s" delay="-6s" />
      <Orb variant="primary" size="lg" className="top-[4%] -right-[10%]" duration="19s" delay="-2s" />
      <Orb variant="primary" size="md" className="top-[38%] left-[-8%]" duration="21s" delay="-11s" />
      <Orb variant="deep" size="lg" className="-bottom-[16%] right-[8%]" duration="26s" delay="-8s" />
      <Orb variant="highlight" size="sm" className="top-[16%] left-[32%]" duration="14s" delay="-4s" />

      <div className="bg-noise" />
      <div className="bg-vignette" />
    </div>
  );
}
