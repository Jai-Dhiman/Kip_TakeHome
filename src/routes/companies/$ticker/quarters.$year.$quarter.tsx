import { Link, createFileRoute } from "@tanstack/react-router";
import { CredibilityGauge } from "~/components/CredibilityGauge";
import { ScoreBreakdown } from "~/components/ScoreBreakdown";
import { DebateView } from "~/components/DebateView";
import { OmissionAlert } from "~/components/OmissionAlert";
import { ClaimsTable } from "~/components/ClaimsTable";
import { quarterDetailQueryOptions } from "~/lib/queries";
import { formatQuarter } from "~/lib/utils";

export const Route = createFileRoute(
  "/companies/$ticker/quarters/$year/$quarter"
)({
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(
      quarterDetailQueryOptions(
        params.ticker,
        Number(params.year),
        Number(params.quarter)
      )
    ),
  component: QuarterDetail,
});

function QuarterDetail() {
  const data = Route.useLoaderData();
  const { ticker } = Route.useParams();

  if (!data) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl text-zinc-400">Quarter not found</h2>
        <Link
          to="/companies/$ticker"
          params={{ ticker }}
          className="text-emerald-400 hover:underline mt-2 inline-block"
        >
          Back to company
        </Link>
      </div>
    );
  }

  const { quarter, score, debate, claims } = data;
  const omissions: string[] = score?.omitted_metrics
    ? JSON.parse(score.omitted_metrics)
    : [];

  const statusCounts = claims.reduce(
    (acc, c) => {
      const s = c.verification?.status ?? "unverifiable";
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="mt-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3">
          <Link to="/" className="hover:text-zinc-300 transition-colors">
            Dashboard
          </Link>
          <span className="text-zinc-700">/</span>
          <Link
            to="/companies/$ticker"
            params={{ ticker }}
            className="hover:text-zinc-300 transition-colors"
          >
            {ticker}
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-400">
            {formatQuarter(quarter.fiscal_year, quarter.fiscal_quarter)}
          </span>
        </div>

        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {formatQuarter(quarter.fiscal_year, quarter.fiscal_quarter)}
            </h2>
            <p className="text-sm text-zinc-500">
              Period ending {quarter.period_end_date}
              {quarter.transcript_date &&
                ` | Earnings call: ${quarter.transcript_date}`}
            </p>
          </div>
          {score && <CredibilityGauge score={score.overall_score} size={72} />}
        </div>
      </div>

      {/* Score Breakdown */}
      {score && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
            Credibility Assessment
          </h3>
          <ScoreBreakdown
            accuracy={score.accuracy_score}
            framing={score.framing_score}
            consistency={score.consistency_score}
            transparency={score.transparency_score}
          />
        </div>
      )}

      {/* The Debate */}
      {debate && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
            The Debate: Bull vs Bear
          </h3>
          <DebateView debate={debate} />
        </div>
      )}

      {/* What They're Not Telling You */}
      {omissions.length > 0 && (
        <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-6">
          <h3 className="text-sm font-medium text-amber-400 uppercase tracking-wider mb-3">
            What They're Not Telling You
          </h3>
          <div className="space-y-2">
            {omissions.map((omission, i) => (
              <OmissionAlert key={i} text={omission} />
            ))}
          </div>
        </div>
      )}

      {/* Claims */}
      <div className="space-y-6">
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
          All Claims ({claims.length})
        </h3>

        {/* Summary badges */}
        <div className="flex flex-wrap gap-2">
          <Badge color="#22c55e" label="Verified" count={statusCounts.verified ?? 0} />
          <Badge color="#ef4444" label="Inaccurate" count={statusCounts.inaccurate ?? 0} />
          <Badge color="#f59e0b" label="Misleading" count={statusCounts.misleading ?? 0} />
          <Badge color="#94a3b8" label="Unverifiable" count={statusCounts.unverifiable ?? 0} />
        </div>

        <ClaimsTable claims={claims} />
      </div>
    </div>
  );
}

function Badge({
  color,
  label,
  count,
}: {
  color: string;
  label: string;
  count: number;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
      style={{
        backgroundColor: `${color}15`,
        color,
        border: `1px solid ${color}30`,
      }}
    >
      <span className="font-bold tabular-nums">{count}</span>
      {label}
    </span>
  );
}
