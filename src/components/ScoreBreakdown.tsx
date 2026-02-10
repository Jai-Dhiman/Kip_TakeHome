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
    <div className="space-y-3">
      {dimensions.map((dim) => (
        <div key={dim.label} className="group">
          <div className="flex items-center justify-between mb-1">
            <div>
              <span className="text-sm font-medium text-zinc-300">
                {dim.label}
              </span>
              <span className="ml-2 text-xs text-zinc-600 hidden group-hover:inline">
                {dim.description}
              </span>
            </div>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: scoreColor(dim.value) }}
            >
              {Math.round(dim.value)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
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
