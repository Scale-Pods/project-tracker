export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <p className="text-[11px] tracking-[0.08em] text-accent-primary/80 uppercase">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-medium text-text-primary sm:text-2xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}
