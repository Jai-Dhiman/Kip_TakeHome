import { createFileRoute, Link } from "@tanstack/react-router";
import { CredibilityGauge } from "~/components/CredibilityGauge";
import { TrendSparkline } from "~/components/TrendSparkline";
import { companiesQueryOptions } from "~/lib/queries";
import type { CompanyWithScore } from "~/lib/types";
import { scoreColor, scoreLabel } from "~/lib/utils";

export const Route = createFileRoute("/")({
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(companiesQueryOptions()),
	component: Dashboard,
});

function Dashboard() {
	const companies = Route.useLoaderData();

	return (
		<div>
			{/* Editorial header */}
			<header className="mb-8">
				<h1 className="text-3xl font-serif text-ink-900 tracking-tight">
					Credibility Dashboard
				</h1>
				<hr className="rule-line-strong mt-2 mb-3" />
				<p className="text-sm text-ink-400 font-sans max-w-2xl leading-relaxed">
					AI-verified earnings call analysis across {companies.length}{" "}
					companies. Claims extracted from transcripts, verified against SEC
					filings, then debated by Bull and Bear agents.
				</p>
			</header>

			{/* Company grid */}
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
			className="company-card group"
		>
			{/* Ticker + sector row */}
			<div className="flex items-start justify-between">
				<div className="min-w-0">
					<div className="flex items-center gap-2.5">
						<span className="font-mono text-base font-bold text-ink-900 tracking-tight">
							{company.ticker}
						</span>
						<span className="sector-tag">{company.sector}</span>
					</div>
					<p className="mt-0.5 text-[13px] text-ink-400 truncate max-w-[180px] font-sans">
						{company.name}
					</p>
				</div>
				{score !== null && <CredibilityGauge score={score} size={52} />}
			</div>

			{/* Score + sparkline row */}
			<div className="mt-4 flex items-end justify-between">
				<div>
					{score !== null ? (
						<>
							<span
								className="font-mono text-2xl font-bold"
								style={{ color: scoreColor(score) }}
							>
								{Math.round(score)}
							</span>
							<span className="ml-1.5 text-[11px] font-sans text-ink-400 font-medium">
								{scoreLabel(score)}
							</span>
						</>
					) : (
						<span className="text-sm text-parchment-500 font-sans">
							No data yet
						</span>
					)}
				</div>
				{quarterScores.length > 1 && (
					<TrendSparkline scores={quarterScores} width={80} height={28} />
				)}
			</div>

			{/* Dimension scores — dense row */}
			{company.latest_score && (
				<div className="mt-3 pt-3 border-t border-parchment-200 grid grid-cols-4 gap-1">
					{(
						[
							["ACC", company.latest_score.accuracy_score],
							["FRM", company.latest_score.framing_score],
							["CON", company.latest_score.consistency_score],
							["TRN", company.latest_score.transparency_score],
						] as const
					).map(([label, val]) => (
						<div key={label} className="text-center">
							<div className="text-[9px] font-sans font-semibold text-parchment-500 uppercase tracking-widest">
								{label}
							</div>
							<div
								className="font-mono text-xs font-semibold"
								style={{ color: scoreColor(val) }}
							>
								{Math.round(val)}
							</div>
						</div>
					))}
				</div>
			)}

			{/* Claim stats footer */}
			{company.latest_score && (
				<div className="mt-3 flex gap-2 text-[10px] font-sans text-ink-400">
					<span className="font-mono font-medium">
						{company.latest_score.total_claims} claims
					</span>
					<span className="text-parchment-400">|</span>
					<span className="font-mono" style={{ color: "#2D7A4F" }}>
						{company.latest_score.verified_claims} verified
					</span>
					<span className="text-parchment-400">|</span>
					<span className="font-mono" style={{ color: "#B54A32" }}>
						{company.latest_score.inaccurate_claims} inaccurate
					</span>
				</div>
			)}
		</Link>
	);
}
