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
        <h2 className="text-xl text-zinc-400">Transcript not found</h2>
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

  const { quarter, claims } = data;

  // Group claims by speaker for easy lookup
  const claimsByQuote = new Map<string, ClaimWithVerification>();
  for (const claim of claims) {
    claimsByQuote.set(claim.exact_quote, claim);
  }

  // Group claims by session
  const preparedClaims = claims.filter(
    (c) => c.session === "prepared_remarks"
  );
  const qaClaims = claims.filter((c) => c.session === "qa");

  return (
    <div className="mt-8 space-y-6">
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
          <Link
            to="/companies/$ticker/quarters/$year/$quarter"
            params={{
              ticker,
              year: String(quarter.fiscal_year),
              quarter: String(quarter.fiscal_quarter),
            }}
            className="hover:text-zinc-300 transition-colors"
          >
            {formatQuarter(quarter.fiscal_year, quarter.fiscal_quarter)}
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-400">Transcript</span>
        </div>

        <h2 className="text-2xl font-bold text-white">
          Earnings Call Transcript
        </h2>
        <p className="text-sm text-zinc-500">
          {formatQuarter(quarter.fiscal_year, quarter.fiscal_quarter)} | Claims
          highlighted inline
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
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
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: `${VERDICT_COLORS[status]}30` }}
            />
            <span className="text-zinc-400">{label}</span>
          </span>
        ))}
      </div>

      {/* Prepared Remarks */}
      {preparedClaims.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4 border-b border-zinc-800 pb-2">
            Prepared Remarks
          </h3>
          <div className="space-y-4">
            {preparedClaims.map((claim) => (
              <TranscriptClaim key={claim.id} claim={claim} />
            ))}
          </div>
        </section>
      )}

      {/* Q&A */}
      {qaClaims.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4 border-b border-zinc-800 pb-2">
            Q&A Session
          </h3>
          <div className="space-y-4">
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
          <span className="text-xs font-medium text-zinc-500">
            {claim.speaker_name}
          </span>
          <br />
          <span className="text-[10px] text-zinc-600">{claim.speaker_role}</span>
        </div>
        <div
          className="flex-1 rounded-lg px-4 py-3 border-l-2"
          style={{
            backgroundColor: `${color}08`,
            borderColor: color,
          }}
        >
          <p className="text-sm text-zinc-300 italic leading-relaxed">
            "{claim.exact_quote}"
          </p>
          <div className="mt-2 flex items-center gap-3 text-[10px]">
            <span
              className="rounded-full px-2 py-0.5 font-semibold uppercase"
              style={{
                backgroundColor: `${color}15`,
                color,
              }}
            >
              {status}
            </span>
            <span className="text-zinc-600">
              {claim.metric_name} | {claim.claimed_value}{" "}
              {claim.claimed_unit.replace(/_/g, " ")}
            </span>
            {claim.verification?.actual_value != null && (
              <span className="text-zinc-500">
                Actual: {claim.verification.actual_value.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
