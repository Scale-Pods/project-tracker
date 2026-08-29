import { formatDate } from "@/lib/format";

// Zero-dependency inline-SVG line chart — the repo has no charting library and
// progress is otherwise only ever the thin ProgressBar. Plots the DPI curve
// against the planned-pace line across the development window; each marked point
// is a processed meeting.

export type TrendPoint = { date: string; dpi: number; expected: number };

const VB_W = 680;
const VB_H = 150;
const PAD = { top: 12, right: 12, bottom: 22, left: 28 };

export function TrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) return null;

  const times = points.map((p) => new Date(p.date).getTime());
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const tSpan = tMax - tMin || 1;

  const plotW = VB_W - PAD.left - PAD.right;
  const plotH = VB_H - PAD.top - PAD.bottom;

  const x = (t: number) => PAD.left + ((t - tMin) / tSpan) * plotW;
  const y = (v: number) => PAD.top + (1 - Math.min(100, Math.max(0, v)) / 100) * plotH;

  const toPath = (key: "dpi" | "expected") =>
    points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${x(times[i]).toFixed(1)} ${y(p[key]).toFixed(1)}`)
      .join(" ");

  const areaPath =
    `${toPath("dpi")} L ${x(tMax).toFixed(1)} ${y(0).toFixed(1)} ` +
    `L ${x(tMin).toFixed(1)} ${y(0).toFixed(1)} Z`;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="h-auto w-full min-w-[320px]"
        role="img"
        aria-label="Development progress over time versus planned pace"
      >
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={VB_W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--color-border-subtle)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y(v) + 3}
              textAnchor="end"
              fontSize={9}
              fill="var(--color-text-secondary)"
            >
              {v}
            </text>
          </g>
        ))}

        <path d={areaPath} fill="var(--color-status-good)" fillOpacity={0.1} />

        <path
          d={toPath("expected")}
          fill="none"
          stroke="var(--color-text-secondary)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={toPath("dpi")}
          fill="none"
          stroke="var(--color-status-good)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />

        {points.map((p, i) => (
          <circle
            key={i}
            cx={x(times[i])}
            cy={y(p.dpi)}
            r={2.5}
            fill="var(--color-status-good)"
          />
        ))}

        <text x={PAD.left} y={VB_H - 6} fontSize={9} fill="var(--color-text-secondary)">
          {formatDate(points[0].date)}
        </text>
        <text
          x={VB_W - PAD.right}
          y={VB_H - 6}
          textAnchor="end"
          fontSize={9}
          fill="var(--color-text-secondary)"
        >
          {formatDate(points[points.length - 1].date)}
        </text>
      </svg>

      <div className="mt-1 flex items-center gap-4 text-[11px] text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-status-good" />
          Development progress
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-0.5 w-4 rounded-full"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, var(--color-text-secondary) 0 4px, transparent 4px 8px)",
            }}
          />
          Planned pace
        </span>
      </div>
    </div>
  );
}
