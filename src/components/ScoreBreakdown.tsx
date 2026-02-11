import { scoreColor } from "~/lib/utils";

export function ScoreBreakdown({
  accuracy,
  framing,
  consistency,
  transparency,
}: {
  accuracy: number;
  framing: number;
  consistency: number;
  transparency: number;
}) {
  const dimensions = [
    { label: "Accuracy", value: accuracy, description: "Factual correctness of claims" },
    { label: "Framing", value: framing, description: "Balanced presentation of data" },
    { label: "Consistency", value: consistency, description: "Alignment with prior quarters" },
    { label: "Transparency", value: transparency, description: "Discussion of both good and bad" },
  ];

  return (
    <div className="space-y-4">
      {dimensions.map((dim) => (
        <div key={dim.label} className="group">
          <div className="flex items-baseline justify-between mb-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-sans font-semibold text-ink-900">
                {dim.label}
              </span>
              <span className="text-[11px] font-sans text-ink-300 hidden group-hover:inline">
                {dim.description}
              </span>
            </div>
            <span
              className="font-mono text-sm font-bold"
              style={{ color: scoreColor(dim.value) }}
            >
              {Math.round(dim.value)}
            </span>
          </div>
          <div className="score-bar">
            <div
              className="score-bar-fill"
              style={{
                width: `${dim.value}%`,
                backgroundColor: scoreColor(dim.value),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
