import { Link, createFileRoute } from "@tanstack/react-router";
import { VERDICT_COLORS } from "~/lib/types";
import { quarterDetailQueryOptions } from "~/lib/queries";
import { formatQuarter } from "~/lib/utils";
import type { ClaimWithVerification } from "~/lib/types";

export const Route = createFileRoute(
  "/companies/$ticker/transcript/$year/$quarter"
)({
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(
      quarterDetailQueryOptions(
        params.ticker,
        Number(params.year),
        Number(params.quarter)
      )
    ),
  component: TranscriptViewer,
});

function TranscriptViewer() {
  const data = Route.useLoaderData();
  const { ticker } = Route.useParams();

  if (!data) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-serif text-ink-400">Transcript not found</h2>
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

  const { quarter, claims } = data;

  const claimsByQuote = new Map<string, ClaimWithVerification>();
  for (const claim of claims) {
    claimsByQuote.set(claim.exact_quote, claim);
  }

  const preparedClaims = claims.filter(
    (c) => c.session === "prepared_remarks"
  );
  const qaClaims = claims.filter((c) => c.session === "qa");

  return (
    <div className="mt-8 space-y-6">
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
        <Link
          to="/companies/$ticker/quarters/$year/$quarter"
          params={{
            ticker,
            year: String(quarter.fiscal_year),
            quarter: String(quarter.fiscal_quarter),
          }}
          className="breadcrumb-link"
        >
          {formatQuarter(quarter.fiscal_year, quarter.fiscal_quarter)}
        </Link>
        <span className="breadcrumb-sep">/</span>
        <span className="text-xs font-sans font-medium text-ink-900">Transcript</span>
      </div>

      {/* Header */}
      <header>
        <h2 className="text-2xl font-serif text-ink-900">
          Earnings Call Transcript
        </h2>
        <p className="text-sm font-sans text-ink-400 mt-1">
          {formatQuarter(quarter.fiscal_year, quarter.fiscal_quarter)} | Claims
          highlighted inline
        </p>
        <hr className="rule-line-strong mt-3" />
      </header>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs font-sans">
        {(
          [
            ["verified", "Verified"],
            ["inaccurate", "Inaccurate"],
            ["misleading", "Misleading"],
            ["unverifiable", "Unverifiable"],
          ] as const
        ).map(([status, label]) => (
          <span key={status} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5"
              style={{ backgroundColor: `${VERDICT_COLORS[status]}40` }}
            />
            <span className="text-ink-400">{label}</span>
          </span>
        ))}
      </div>

      {/* Prepared Remarks */}
      {preparedClaims.length > 0 && (
        <section>
          <h3 className="text-base font-serif text-ink-900 mb-3 pb-2 border-b-2 border-ink-900">
            Prepared Remarks
          </h3>
          <div className="space-y-3">
            {preparedClaims.map((claim) => (
              <TranscriptClaim key={claim.id} claim={claim} />
            ))}
          </div>
        </section>
      )}

      {/* Q&A */}
      {qaClaims.length > 0 && (
        <section>
          <h3 className="text-base font-serif text-ink-900 mb-3 pb-2 border-b-2 border-ink-900">
            Q&A Session
          </h3>
          <div className="space-y-3">
            {qaClaims.map((claim) => (
              <TranscriptClaim key={claim.id} claim={claim} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TranscriptClaim({ claim }: { claim: ClaimWithVerification }) {
  const status = claim.verification?.status ?? "unverifiable";
  const color = VERDICT_COLORS[status];

  return (
    <div className="group">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-24 text-right">
          <span className="text-xs font-sans font-medium text-ink-500">
            {claim.speaker_name}
          </span>
          <br />
          <span className="text-[10px] font-sans text-ink-300">{claim.speaker_role}</span>
        </div>
        <div
          className="flex-1 px-4 py-3 bg-white"
          style={{
            borderLeft: `3px solid ${color}`,
          }}
        >
          <p className="text-[13px] font-sans text-ink-700 italic leading-relaxed">
            "{claim.exact_quote}"
          </p>
          <div className="mt-2 flex items-center gap-3 text-[10px] font-sans">
            <span
              className="verdict-badge"
              style={{
                backgroundColor: `${color}12`,
                color,
              }}
            >
              {status}
            </span>
            <span className="text-ink-300 font-mono">
              {claim.metric_name} | {claim.claimed_value}{" "}
              {claim.claimed_unit.replace(/_/g, " ")}
            </span>
            {claim.verification?.actual_value != null && (
              <span className="text-ink-400 font-mono">
                Actual: {claim.verification.actual_value.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
