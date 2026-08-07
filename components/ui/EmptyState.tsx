export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="glass-panel flex flex-col items-center justify-center rounded-2xl px-6 py-20 text-center">
      {icon && (
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-elevated/70 text-accent-primary backdrop-blur-md">
          {icon}
        </div>
      )}
      <h2 className="text-lg font-medium text-text-primary">{title}</h2>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-text-secondary">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
