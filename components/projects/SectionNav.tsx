"use client";

import { useEffect, useMemo, useState } from "react";

const BASE_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "summary", label: "Summary" },
  { id: "progress", label: "Progress" },
  { id: "team", label: "Team" },
  { id: "blockers", label: "Blockers" },
  { id: "tasks", label: "Pending Tasks" },
  { id: "activity", label: "Activity Log" },
];

// Sticky in-page nav on desktop, per Section 9.1 (hidden on mobile — normal
// scroll instead). Highlights whichever section is currently in view.
export function SectionNav({
  showClosure,
  showPayout = false,
}: {
  showClosure: boolean;
  showPayout?: boolean;
}) {
  const sections = useMemo(() => {
    const withClosure = showClosure
      ? [...BASE_SECTIONS, { id: "closure", label: "Closure" }]
      : BASE_SECTIONS;
    return showPayout ? [...withClosure, { id: "payout", label: "Payout" }] : withClosure;
  }, [showClosure, showPayout]);
  const [active, setActive] = useState(sections[0].id);

  useEffect(() => {
    const handleScroll = () => {
      // Check if user has scrolled to bottom of page
      const isAtBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 60;
      if (isAtBottom) {
        setActive(sections[sections.length - 1].id);
        return;
      }

      const sectionElements = sections
        .map((s) => document.getElementById(s.id))
        .filter((el): el is HTMLElement => el !== null);

      let currentActive = sections[0].id;
      for (const el of sectionElements) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= window.innerHeight * 0.35) {
          currentActive = el.id;
        }
      }
      setActive(currentActive);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [sections]);

  return (
    <nav
      className="sticky top-10 hidden self-start glass-panel rounded-2xl p-4 lg:block"
      aria-label="Section navigation"
    >
      <ul className="space-y-1.5 pl-1">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className={`block rounded-r-lg border-l-2 py-1.5 pl-3.5 text-sm transition-all ${
                active === s.id
                  ? "border-accent-primary font-medium text-text-primary bg-accent-primary/10 shadow-[0_0_12px_-3px_rgba(22,22,172,0.4)]"
                  : "border-transparent text-text-secondary hover:border-text-secondary/30 hover:text-text-primary"
              }`}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
