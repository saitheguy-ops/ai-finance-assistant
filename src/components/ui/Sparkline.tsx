import type { PricePoint } from "@/lib/types";

/**
 * A dependency-free SVG sparkline. Points are scaled into a fixed viewBox and
 * the SVG stretches to its container. A dashed line marks the reference price
 * (previous close) so you can see at a glance whether it's up or down today.
 */
export function Sparkline({
  points,
  reference,
  width = 120,
  height = 36,
  className = "",
  label,
}: {
  points: PricePoint[];
  reference?: number | null;
  width?: number;
  height?: number;
  className?: string;
  label?: string;
}) {
  if (points.length < 2) {
    return <div style={{ width, height }} className={`rounded bg-surface-2 ${className}`} aria-hidden />;
  }
  const values = points.map((p) => p.c);
  if (typeof reference === "number") values.push(reference);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 2;
  const x = (i: number) => (i / (points.length - 1)) * width;
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);

  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.c).toFixed(1)}`).join("");
  const last = points[points.length - 1].c;
  const base = typeof reference === "number" ? reference : points[0].c;
  const stroke = last >= base ? "var(--up)" : "var(--down)";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label={label ?? "Price trend"}
    >
      {typeof reference === "number" && (
        <line
          x1={0}
          x2={width}
          y1={y(reference)}
          y2={y(reference)}
          stroke="var(--text-muted)"
          strokeOpacity={0.5}
          strokeDasharray="2 3"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.75} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
