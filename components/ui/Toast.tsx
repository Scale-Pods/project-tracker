export type ToastMessage = {
  id: number;
  tone: "success" | "error";
  message: string;
};

const TONE_CLASSES: Record<ToastMessage["tone"], string> = {
  success: "border-status-good/40 text-status-good",
  error: "border-status-bad/40 text-status-bad",
};

export function ToastStack({ toasts }: { toasts: ToastMessage[] }) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-5 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className={`animate-card-in pointer-events-auto rounded-xl border bg-surface-elevated/90 px-4 py-2.5 text-sm font-medium shadow-[0_10px_15px_-3px_rgba(0,0,0,0.3),0_4px_6px_-4px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md ${TONE_CLASSES[toast.tone]}`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
