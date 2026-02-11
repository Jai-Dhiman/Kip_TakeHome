import { Link, createFileRoute, Outlet } from "@tanstack/react-router";
import { CredibilityGauge } from "~/components/CredibilityGauge";
import { ScoreBreakdown } from "~/components/ScoreBreakdown";
import { TrendSparkline } from "~/components/TrendSparkline";
import { OmissionAlert } from "~/components/OmissionAlert";
import { companyQueryOptions } from "~/lib/queries";
import { scoreColor, formatQuarter } from "~/lib/utils";

export const Route = createFileRoute("/companies/$ticker")({
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(companyQueryOptions(params.ticker)),
  component: CompanyDetail,
});

function CompanyDetail() {
  const company = Route.useLoaderData();

  if (!company) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl text-zinc-400">Company not found</h2>
        <Link to="/" className="text-emerald-400 hover:underline mt-2 inline-block">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const score = company.latest_score;
  const quarterScores = company.quarters
    .map((q) => q.overall_score)
    .filter((s): s is number => s !== null)
    .reverse();

  const omissions: string[] = score?.omitted_metrics
    ? JSON.parse(score.omitted_metrics)
    : [];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/"
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Dashboard
        </Link>
        <span className="text-xs text-zinc-700 mx-2">/</span>
        <span className="text-xs text-zinc-400">{company.ticker}</span>

        <div className="mt-3 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              {company.name}
            </h1>
            <div className="mt-1 flex items-center gap-3">
              <span className="text-lg font-semibold text-zinc-400">
                {company.ticker}
              </span>
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                {company.sector}
              </span>
            </div>
          </div>
          {score && <CredibilityGauge score={score.overall_score} size={80} />}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: scores */}
        <div className="lg:col-span-2 space-y-6">
          {/* Score breakdown */}
          {score && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
              <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
                Credibility Breakdown
              </h2>
              <ScoreBreakdown
                accuracy={score.accuracy_score}
                framing={score.framing_score}
                consistency={score.consistency_score}
                transparency={score.transparency_score}
              />
              {score.summary && (
                <p className="mt-4 text-sm text-zinc-400 leading-relaxed">
                  {score.summary.slice(0, 500)}
                  {score.summary.length > 500 ? "..." : ""}
                </p>
              )}
            </div>
          )}

          {/* Trend */}
          {quarterScores.length > 1 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
              <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
                Credibility Trend
              </h2>
              <div className="flex items-center gap-6">
                <TrendSparkline
                  scores={quarterScores}
                  width={320}
                  height={80}
                />
                <div className="flex flex-col gap-1">
                  {company.quarters
                    .filter((q) => q.overall_score !== null)
                    .map((q) => (
                      <Link
                        key={q.id}
                        to="/companies/$ticker/quarters/$year/$quarter"
                        params={{
                          ticker: company.ticker,
                          year: String(q.fiscal_year),
                          quarter: String(q.fiscal_quarter),
                        }}
                        className="flex items-center gap-2 text-xs hover:text-white transition-colors"
                      >
                        <span className="text-zinc-500">
                          {formatQuarter(q.fiscal_year, q.fiscal_quarter)}
                        </span>
                        <span
                          className="font-medium tabular-nums"
                          style={{
                            color: scoreColor(q.overall_score!),
                          }}
                        >
                          {Math.round(q.overall_score!)}
                        </span>
                      </Link>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* What They're Not Telling You */}
          {omissions.length > 0 && (
            <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-6">
              <h2 className="text-sm font-medium text-amber-400 uppercase tracking-wider mb-3">
                What They're Not Telling You
              </h2>
              <div className="space-y-2">
                {omissions.map((omission, i) => (
                  <OmissionAlert key={i} text={omission} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: quarters list */}
        <div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
              Quarterly Reports
            </h2>
            <div className="space-y-2">
              {company.quarters.map((q) => (
                <Link
                  key={q.id}
                  to="/companies/$ticker/quarters/$year/$quarter"
                  params={{
                    ticker: company.ticker,
                    year: String(q.fiscal_year),
                    quarter: String(q.fiscal_quarter),
                  }}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-3 hover:border-zinc-600 hover:bg-zinc-800/50 transition-all"
                >
                  <div>
                    <span className="text-sm font-medium text-white">
                      {formatQuarter(q.fiscal_year, q.fiscal_quarter)}
                    </span>
                    <span className="ml-2 text-xs text-zinc-500">
                      {q.period_end_date}
                    </span>
                  </div>
                  {q.overall_score !== null && (
                    <span
                      className="text-lg font-bold tabular-nums"
                      style={{ color: scoreColor(q.overall_score) }}
                    >
                      {Math.round(q.overall_score)}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* Claim stats */}
          {score && (
            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
              <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">
                Latest Quarter Claims
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Total" value={score.total_claims} />
                <Stat
                  label="Verified"
                  value={score.verified_claims}
                  color="#22c55e"
                />
                <Stat
                  label="Inaccurate"
                  value={score.inaccurate_claims}
                  color="#ef4444"
                />
                <Stat
                  label="Misleading"
                  value={score.misleading_claims}
                  color="#f59e0b"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <Outlet />
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="text-center rounded-lg bg-zinc-800/50 py-2">
      <div
        className="text-xl font-bold tabular-nums"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}
