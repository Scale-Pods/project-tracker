"use client";

import { useEffect, useRef, useState } from "react";

export function FilterDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggle(option: string) {
    onChange(
      selected.includes(option)
        ? selected.filter((o) => o !== option)
        : [...selected, option]
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
          selected.length > 0
            ? "glass-input border-accent-primary/60 bg-accent-primary/20 text-text-primary shadow-[0_0_20px_-4px_rgba(22,22,172,0.5)]"
            : "glass-input text-text-secondary hover:text-text-primary"
        }`}
      >
        {label}
        {selected.length > 0 && (
          <span className="rounded-full bg-accent-primary px-1.5 py-0.5 text-[10px] text-white">
            {selected.length}
          </span>
        )}
        <span className="text-[10px]">▾</span>
      </button>

      {open && (
        <div className="glass-dropdown animate-card-in absolute left-0 z-20 mt-2 min-w-[190px] rounded-2xl p-2.5">
          {options.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-text-primary transition-colors hover:bg-white/10"
            >
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => toggle(option)}
                className="h-3.5 w-3.5 accent-[#1616ac]"
              />
              {option}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
