import type { ClaimWithVerification } from "~/lib/types";
import { VERDICT_COLORS, VERDICT_LABELS } from "~/lib/types";

export function ClaimCard({ claim }: { claim: ClaimWithVerification }) {
	const status = claim.verification?.status ?? "unverifiable";
	const color = VERDICT_COLORS[status];
	const label = VERDICT_LABELS[status];

	return (
		<div
			className="bg-white border border-parchment-300 p-4"
			style={{ borderLeftWidth: 3, borderLeftColor: color }}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="flex-1 min-w-0">
					<blockquote
						className="text-[13px] text-ink-700 italic font-sans leading-relaxed mb-2 pl-3"
						style={{ borderLeft: `2px solid ${color}40` }}
					>
						"{claim.exact_quote}"
					</blockquote>

					<div className="text-[11px] text-ink-400 font-sans mb-2">
						-- {claim.speaker_name} ({claim.speaker_role}),{" "}
						{claim.session === "prepared_remarks" ? "Prepared Remarks" : "Q&A"}
					</div>

					<div className="flex flex-wrap gap-4 text-xs font-sans">
						<div>
							<span className="text-ink-300">Claimed: </span>
							<span className="font-mono font-medium text-ink-700">
								{formatClaimedValue(claim)}
							</span>
						</div>
						{claim.verification?.actual_value !== null &&
							claim.verification?.actual_value !== undefined && (
								<div>
									<span className="text-ink-300">Actual: </span>
									<span className="font-mono font-medium" style={{ color }}>
										{claim.verification.actual_value.toFixed(2)}
									</span>
								</div>
							)}
						{claim.verification?.deviation_percentage !== null &&
							claim.verification?.deviation_percentage !== undefined && (
								<div>
									<span className="text-ink-300">Deviation: </span>
									<span className="font-mono font-medium" style={{ color }}>
										{claim.verification.deviation_percentage.toFixed(1)}%
									</span>
								</div>
							)}
					</div>

					{claim.misleading && (
						<div className="mt-2">
							<div className="flex flex-wrap gap-1">
								{(JSON.parse(claim.misleading.tactics) as string[]).map(
									(tactic) => (
										<span
											key={tactic}
											className="font-sans text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5"
											style={{
												backgroundColor: "#C48B2015",
												color: "#C48B20",
												border: "1px solid #C48B2030",
											}}
										>
											{tactic.replace(/_/g, " ")}
										</span>
									),
								)}
							</div>
							<p className="mt-1 text-[11px] text-ink-400 font-sans">
								{claim.misleading.explanation}
							</p>
						</div>
					)}
				</div>

				<span
					className="verdict-badge shrink-0"
					style={{
						backgroundColor: `${color}12`,
						color,
						border: `1px solid ${color}25`,
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
