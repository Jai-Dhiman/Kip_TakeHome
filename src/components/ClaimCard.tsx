import type { ClaimWithVerification } from "~/lib/types";
import { VERDICT_COLORS, VERDICT_LABELS } from "~/lib/types";

export function ClaimCard({ claim }: { claim: ClaimWithVerification }) {
  const status = claim.verification?.status ?? "unverifiable";
  const color = VERDICT_COLORS[status];
  const label = VERDICT_LABELS[status];

  return (
    <div
      className="rounded-lg border bg-zinc-900/50 p-4"
      style={{ borderColor: `${color}30` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Quote */}
          <blockquote className="text-sm text-zinc-300 italic border-l-2 pl-3 mb-2"
            style={{ borderColor: `${color}60` }}
          >
            "{claim.exact_quote}"
          </blockquote>

          {/* Speaker */}
          <div className="text-xs text-zinc-500 mb-2">
            -- {claim.speaker_name} ({claim.speaker_role}),{" "}
            {claim.session === "prepared_remarks" ? "Prepared Remarks" : "Q&A"}
          </div>

          {/* What they said vs actual */}
          <div className="flex flex-wrap gap-4 text-xs">
            <div>
              <span className="text-zinc-600">Claimed: </span>
              <span className="text-zinc-300 font-medium tabular-nums">
                {formatClaimedValue(claim)}
              </span>
            </div>
            {claim.verification?.actual_value !== null &&
              claim.verification?.actual_value !== undefined && (
                <div>
                  <span className="text-zinc-600">Actual: </span>
                  <span className="font-medium tabular-nums" style={{ color }}>
                    {claim.verification.actual_value.toFixed(2)}
                  </span>
                </div>
              )}
            {claim.verification?.deviation_percentage !== null &&
              claim.verification?.deviation_percentage !== undefined && (
                <div>
                  <span className="text-zinc-600">Deviation: </span>
                  <span className="font-medium tabular-nums" style={{ color }}>
                    {claim.verification.deviation_percentage.toFixed(1)}%
                  </span>
                </div>
              )}
          </div>

          {/* Misleading tactics */}
          {claim.misleading && (
            <div className="mt-2">
              <div className="flex flex-wrap gap-1">
                {(JSON.parse(claim.misleading.tactics) as string[]).map(
                  (tactic) => (
                    <span
                      key={tactic}
                      className="rounded-full bg-amber-950/50 border border-amber-800/30 px-2 py-0.5 text-[10px] text-amber-400"
                    >
                      {tactic.replace(/_/g, " ")}
                    </span>
                  )
                )}
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {claim.misleading.explanation}
              </p>
            </div>
          )}
        </div>

        {/* Verdict badge */}
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
          style={{
            backgroundColor: `${color}15`,
            color,
            border: `1px solid ${color}30`,
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

function formatClaimedValue(claim: ClaimWithVerification): string {
  const v = claim.claimed_value;
  switch (claim.claimed_unit) {
    case "USD_millions":
      return v >= 1000 ? `$${(v / 1000).toFixed(1)}B` : `$${v.toFixed(0)}M`;
    case "USD_billions":
      return `$${v.toFixed(1)}B`;
    case "percentage":
      return `${v.toFixed(1)}%`;
    case "USD_per_share":
      return `$${v.toFixed(2)}/share`;
    case "basis_points":
      return `${v.toFixed(0)}bps`;
    default:
      return String(v);
  }
}
