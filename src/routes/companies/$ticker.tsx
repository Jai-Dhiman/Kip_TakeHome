import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { CredibilityGauge } from "~/components/CredibilityGauge";
import { OmissionAlert } from "~/components/OmissionAlert";
import { ScoreBreakdown } from "~/components/ScoreBreakdown";
import { TrendSparkline } from "~/components/TrendSparkline";
import { companyQueryOptions } from "~/lib/queries";
import { formatQuarter, scoreColor } from "~/lib/utils";

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
				<h2 className="text-xl font-serif text-ink-400">Company not found</h2>
				<Link
					to="/"
					className="text-rust-500 link-underline mt-2 inline-block font-sans text-sm"
				>
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
			{/* Breadcrumb */}
			<div className="mb-6">
				<Link to="/" className="breadcrumb-link">
					Dashboard
				</Link>
				<span className="breadcrumb-sep">/</span>
				<span className="text-xs font-sans font-medium text-ink-900">
					{company.ticker}
				</span>
			</div>

			{/* Header */}
			<header className="mb-8">
				<div className="flex items-start justify-between">
					<div>
						<h1 className="text-3xl font-serif text-ink-900 tracking-tight">
							{company.name}
						</h1>
						<div className="mt-2 flex items-center gap-3">
							<span className="font-mono text-lg font-bold text-ink-600">
								{company.ticker}
							</span>
							<span className="sector-tag">{company.sector}</span>
						</div>
					</div>
					{score && <CredibilityGauge score={score.overall_score} size={76} />}
				</div>
				<hr className="rule-line-strong mt-4" />
			</header>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Left column */}
				<div className="lg:col-span-2 space-y-6">
					{/* Score breakdown */}
					{score && (
						<section className="surface-elevated p-6">
							<h2 className="text-lg font-serif text-ink-900 mb-4">
								Credibility Breakdown
							</h2>
							<hr className="rule-line mb-4" />
							<ScoreBreakdown
								accuracy={score.accuracy_score}
								framing={score.framing_score}
								consistency={score.consistency_score}
								transparency={score.transparency_score}
							/>
							{score.summary && (
								<p className="mt-5 text-[13px] font-sans text-ink-500 leading-relaxed border-t border-parchment-200 pt-4">
									{score.summary.slice(0, 500)}
									{score.summary.length > 500 ? "..." : ""}
								</p>
							)}
						</section>
					)}

					{/* Trend */}
					{quarterScores.length > 1 && (
						<section className="surface-elevated p-6">
							<h2 className="text-lg font-serif text-ink-900 mb-4">
								Credibility Trend
							</h2>
							<hr className="rule-line mb-4" />
							<div className="flex items-center gap-6">
								<TrendSparkline
									scores={quarterScores}
									width={320}
									height={80}
								/>
								<div className="flex flex-col gap-1.5">
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
												className="flex items-center gap-2 text-xs font-sans hover:text-ink-900 transition-colors link-underline"
											>
												<span className="text-ink-400 font-mono">
													{formatQuarter(q.fiscal_year, q.fiscal_quarter)}
												</span>
												<span
													className="font-mono font-bold"
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
						</section>
					)}

					{/* Omissions */}
					{omissions.length > 0 && (
						<section
							className="p-6 bg-white border border-parchment-300"
							style={{ borderLeftWidth: 3, borderLeftColor: "#C48B20" }}
						>
							<h2 className="text-lg font-serif text-ink-900 mb-3">
								What They're Not Telling You
							</h2>
							<hr className="rule-line mb-3" />
							<div className="space-y-2">
								{omissions.map((omission, i) => (
									<OmissionAlert key={i} text={omission} />
								))}
							</div>
						</section>
					)}
				</div>

				{/* Right column */}
				<div className="space-y-4">
					<section className="surface-elevated p-6">
						<h2 className="text-lg font-serif text-ink-900 mb-4">
							Quarterly Reports
						</h2>
						<hr className="rule-line mb-4" />
						<div className="space-y-0">
							{company.quarters.map((q, i) => (
								<Link
									key={q.id}
									to="/companies/$ticker/quarters/$year/$quarter"
									params={{
										ticker: company.ticker,
										year: String(q.fiscal_year),
										quarter: String(q.fiscal_quarter),
									}}
									className="flex items-center justify-between py-3 hover:bg-parchment-50 transition-colors px-2 -mx-2"
									style={
										i < company.quarters.length - 1
											? { borderBottom: "1px solid #F0EBE1" }
											: undefined
									}
								>
									<div>
										<span className="font-mono text-sm font-medium text-ink-900">
											{formatQuarter(q.fiscal_year, q.fiscal_quarter)}
										</span>
										<span className="ml-2 text-[11px] font-sans text-ink-300">
											{q.period_end_date}
										</span>
									</div>
									{q.overall_score !== null && (
										<span
											className="font-mono text-base font-bold"
											style={{ color: scoreColor(q.overall_score) }}
										>
											{Math.round(q.overall_score)}
										</span>
									)}
								</Link>
							))}
						</div>
					</section>

					{/* Claim stats */}
					{score && (
						<section className="surface-elevated p-6">
							<h2 className="text-lg font-serif text-ink-900 mb-4">
								Latest Quarter Claims
							</h2>
							<hr className="rule-line mb-4" />
							<div className="grid grid-cols-2 gap-3">
								<Stat label="Total" value={score.total_claims} />
								<Stat
									label="Verified"
									value={score.verified_claims}
									color="#2D7A4F"
								/>
								<Stat
									label="Inaccurate"
									value={score.inaccurate_claims}
									color="#B54A32"
								/>
								<Stat
									label="Misleading"
									value={score.misleading_claims}
									color="#C48B20"
								/>
							</div>
						</section>
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
		<div className="text-center py-2 bg-parchment-50 border border-parchment-200">
			<div
				className="font-mono text-xl font-bold"
				style={color ? { color } : undefined}
			>
				{value}
			</div>
			<div className="text-[9px] font-sans font-semibold text-ink-300 uppercase tracking-widest">
				{label}
			</div>
		</div>
	);
}
