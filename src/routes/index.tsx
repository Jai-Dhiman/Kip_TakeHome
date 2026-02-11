import { Link, createFileRoute } from "@tanstack/react-router";
import { CredibilityGauge } from "~/components/CredibilityGauge";
import { TrendSparkline } from "~/components/TrendSparkline";
import { companiesQueryOptions } from "~/lib/queries";
import { scoreColor, scoreLabel } from "~/lib/utils";
import type { CompanyWithScore } from "~/lib/types";

export const Route = createFileRoute("/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(companiesQueryOptions()),
  component: Dashboard,
});

function Dashboard() {
  const companies = Route.useLoaderData();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Credibility Dashboard
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          AI-verified earnings call analysis across 10 companies. Claims
          extracted, verified against SEC filings, then debated by Bull and Bear
          agents.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {companies.map((company) => (
          <CompanyCard key={company.ticker} company={company} />
        ))}
      </div>
    </div>
  );
}

function CompanyCard({ company }: { company: CompanyWithScore }) {
  const score = company.latest_score?.overall_score ?? null;
  const quarterScores = company.quarters
    .map((q) => q.overall_score)
    .filter((s): s is number => s !== null)
    .reverse();

  return (
    <Link
      to="/companies/$ticker"
      params={{ ticker: company.ticker }}
      className="group block rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition-all hover:border-zinc-600 hover:bg-zinc-900"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-white">
              {company.ticker}
            </span>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
              {company.sector}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-zinc-500 truncate max-w-[180px]">
            {company.name}
          </p>
        </div>
        {score !== null && <CredibilityGauge score={score} size={56} />}
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          {score !== null ? (
            <>
              <span
                className="text-2xl font-bold tabular-nums"
                style={{ color: scoreColor(score) }}
              >
                {Math.round(score)}
              </span>
              <span className="ml-1.5 text-xs text-zinc-500">
                {scoreLabel(score)}
              </span>
            </>
          ) : (
            <span className="text-sm text-zinc-600">No data yet</span>
          )}
        </div>
        {quarterScores.length > 1 && (
          <TrendSparkline scores={quarterScores} width={80} height={28} />
        )}
      </div>

      {company.latest_score && (
        <div className="mt-3 grid grid-cols-4 gap-1">
          {(
            [
              ["ACC", company.latest_score.accuracy_score],
              ["FRM", company.latest_score.framing_score],
              ["CON", company.latest_score.consistency_score],
              ["TRN", company.latest_score.transparency_score],
            ] as const
          ).map(([label, val]) => (
            <div key={label} className="text-center">
              <div className="text-[10px] text-zinc-600 uppercase tracking-wider">
                {label}
              </div>
              <div
                className="text-xs font-medium tabular-nums"
                style={{ color: scoreColor(val) }}
              >
                {Math.round(val)}
              </div>
            </div>
          ))}
        </div>
      )}

      {company.latest_score && (
        <div className="mt-3 flex gap-2 text-[10px] text-zinc-500">
          <span>
            {company.latest_score.total_claims} claims
          </span>
          <span className="text-zinc-700">|</span>
          <span className="text-emerald-500">
            {company.latest_score.verified_claims} verified
          </span>
          <span className="text-zinc-700">|</span>
          <span className="text-red-400">
            {company.latest_score.inaccurate_claims} inaccurate
          </span>
        </div>
      )}
    </Link>
  );
}
