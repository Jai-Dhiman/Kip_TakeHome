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
        <h2 className="text-xl font-serif text-ink-400">Quarter not found</h2>
        <Link
          to="/companies/$ticker"
          params={{ ticker }}
          className="text-rust-500 link-underline mt-2 inline-block font-sans text-sm"
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
      {/* Breadcrumb */}
      <div>
        <Link to="/" className="breadcrumb-link">
          Dashboard
        </Link>
        <span className="breadcrumb-sep">/</span>
        <Link
          to="/companies/$ticker"
          params={{ ticker }}
          className="breadcrumb-link"
        >
          {ticker}
        </Link>
        <span className="breadcrumb-sep">/</span>
        <span className="text-xs font-sans font-medium text-ink-900">
          {formatQuarter(quarter.fiscal_year, quarter.fiscal_quarter)}
        </span>
      </div>

      {/* Header */}
      <header>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-serif text-ink-900">
              {formatQuarter(quarter.fiscal_year, quarter.fiscal_quarter)}
            </h2>
            <p className="text-sm font-sans text-ink-400 mt-1">
              Period ending {quarter.period_end_date}
              {quarter.transcript_date &&
                ` | Earnings call: ${quarter.transcript_date}`}
            </p>
          </div>
          {score && <CredibilityGauge score={score.overall_score} size={68} />}
        </div>
        <hr className="rule-line-strong mt-3" />
      </header>

      {/* Score Breakdown */}
      {score && (
        <section className="surface-elevated p-6">
          <h3 className="text-lg font-serif text-ink-900 mb-4">
            Credibility Assessment
          </h3>
          <hr className="rule-line mb-4" />
          <ScoreBreakdown
            accuracy={score.accuracy_score}
            framing={score.framing_score}
            consistency={score.consistency_score}
            transparency={score.transparency_score}
          />
        </section>
      )}

      {/* The Debate */}
      {debate && (
        <section className="surface-elevated p-6">
          <h3 className="text-lg font-serif text-ink-900 mb-4">
            The Debate: Bull vs Bear
          </h3>
          <hr className="rule-line mb-4" />
          <DebateView debate={debate} />
        </section>
      )}

      {/* Omissions */}
      {omissions.length > 0 && (
        <section className="p-6 bg-white border border-parchment-300" style={{ borderLeftWidth: 3, borderLeftColor: "#C48B20" }}>
          <h3 className="text-lg font-serif text-ink-900 mb-3">
            What They're Not Telling You
          </h3>
          <hr className="rule-line mb-3" />
          <div className="space-y-2">
            {omissions.map((omission, i) => (
              <OmissionAlert key={i} text={omission} />
            ))}
          </div>
        </section>
      )}

      {/* Claims */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-serif text-ink-900">
            All Claims
          </h3>
          <span className="font-mono text-sm text-ink-300">{claims.length} total</span>
        </div>
        <hr className="rule-line-strong" />

        {/* Summary badges */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Badge color="#2D7A4F" label="Verified" count={statusCounts.verified ?? 0} />
          <Badge color="#B54A32" label="Inaccurate" count={statusCounts.inaccurate ?? 0} />
          <Badge color="#C48B20" label="Misleading" count={statusCounts.misleading ?? 0} />
          <Badge color="#7A8599" label="Unverifiable" count={statusCounts.unverifiable ?? 0} />
          <Badge color="#A0AEC0" label="Not Verified" count={statusCounts.not_verified ?? 0} />
        </div>

        <ClaimsTable claims={claims} />
      </section>
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
      className="verdict-badge"
      style={{
        backgroundColor: `${color}10`,
        color,
        border: `1px solid ${color}20`,
      }}
    >
      <span className="font-mono font-bold">{count}</span>
      <span className="font-sans">{label}</span>
    </span>
  );
}
