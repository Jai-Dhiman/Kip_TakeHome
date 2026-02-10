import { scoreColor } from "~/lib/utils";

export function TrendSparkline({
  scores,
  width = 100,
  height = 32,
}: {
  scores: number[];
  width?: number;
  height?: number;
}) {
  if (scores.length < 2) return null;

  const padding = 4;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const min = Math.min(...scores) - 5;
  const max = Math.max(...scores) + 5;
  const range = max - min || 1;

  const points = scores.map((s, i) => {
    const x = padding + (i / (scores.length - 1)) * innerW;
    const y = padding + innerH - ((s - min) / range) * innerH;
    return `${x},${y}`;
  });

  const lastScore = scores[scores.length - 1]!;
  const prevScore = scores[scores.length - 2]!;
  const trending = lastScore >= prevScore ? "up" : "down";
  const color = scoreColor(lastScore);

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Line */}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="transition-all duration-500"
      />
      {/* Dots */}
      {scores.map((s, i) => {
        const x = padding + (i / (scores.length - 1)) * innerW;
        const y = padding + innerH - ((s - min) / range) * innerH;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i === scores.length - 1 ? 3 : 2}
            fill={i === scores.length - 1 ? color : "#52525b"}
            className="transition-all duration-300"
          />
        );
      })}
    </svg>
  );
}
