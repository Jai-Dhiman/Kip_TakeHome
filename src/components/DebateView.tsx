import type { Debate } from "~/lib/types";

export function DebateView({ debate }: { debate: Debate }) {
	const bullRounds = debate.bull_argument.split("\n\n---\n\n");
	const bearRounds = debate.bear_argument.split("\n\n---\n\n");
	const maxRounds = Math.max(bullRounds.length, bearRounds.length);

	return (
		<div className="space-y-6">
			{Array.from({ length: maxRounds }).map((_, i) => (
				<div key={i} className="space-y-4">
					<div className="text-[10px] font-sans font-semibold text-ink-300 uppercase tracking-widest text-center">
						Round {i + 1}
					</div>

					{bullRounds[i] && (
						<div className="flex gap-3">
							<div className="shrink-0 mt-1">
								<div className="flex h-7 w-7 items-center justify-center bg-teal-700 text-white">
									<span className="text-[10px] font-mono font-bold">B</span>
								</div>
							</div>
							<div className="flex-1 debate-bull px-4 py-3">
								<div className="text-[10px] font-sans font-semibold text-teal-700 uppercase tracking-widest mb-2">
									Bull Researcher
								</div>
								<div className="text-[13px] font-sans text-ink-700 leading-relaxed whitespace-pre-wrap">
									{bullRounds[i]}
								</div>
							</div>
						</div>
					)}

					{bearRounds[i] && (
						<div className="flex gap-3">
							<div className="shrink-0 mt-1">
								<div className="flex h-7 w-7 items-center justify-center bg-rust-500 text-white">
									<span className="text-[10px] font-mono font-bold">B</span>
								</div>
							</div>
							<div className="flex-1 debate-bear px-4 py-3">
								<div className="text-[10px] font-sans font-semibold text-rust-500 uppercase tracking-widest mb-2">
									Bear Researcher
								</div>
								<div className="text-[13px] font-sans text-ink-700 leading-relaxed whitespace-pre-wrap">
									{bearRounds[i]}
								</div>
							</div>
						</div>
					)}
				</div>
			))}

			<div className="mt-8">
				<div className="text-[10px] font-sans font-semibold text-ink-300 uppercase tracking-widest text-center mb-4">
					Verdict
				</div>
				<div className="flex gap-3">
					<div className="shrink-0 mt-1">
						<div
							className="flex h-7 w-7 items-center justify-center"
							style={{ backgroundColor: "#6B5CA5" }}
						>
							<span className="text-[10px] font-mono font-bold text-white">
								J
							</span>
						</div>
					</div>
					<div className="flex-1 debate-judge px-4 py-3">
						<div
							className="text-[10px] font-sans font-semibold uppercase tracking-widest mb-2"
							style={{ color: "#6B5CA5" }}
						>
							Judge
						</div>
						<div className="text-[13px] font-sans text-ink-700 leading-relaxed whitespace-pre-wrap">
							{debate.judge_verdict}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
