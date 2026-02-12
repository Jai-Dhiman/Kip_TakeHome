import Markdown from "react-markdown";
import type { Debate } from "~/lib/types";

const mdComponents = {
	p: (props: React.ComponentProps<"p">) => (
		<p className="mb-2 last:mb-0" {...props} />
	),
	strong: (props: React.ComponentProps<"strong">) => (
		<strong className="font-semibold text-ink-900" {...props} />
	),
	em: (props: React.ComponentProps<"em">) => (
		<em className="italic" {...props} />
	),
	ul: (props: React.ComponentProps<"ul">) => (
		<ul className="list-disc pl-4 mb-2 space-y-1" {...props} />
	),
	ol: (props: React.ComponentProps<"ol">) => (
		<ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />
	),
	li: (props: React.ComponentProps<"li">) => <li className="" {...props} />,
	h1: (props: React.ComponentProps<"h1">) => (
		<h1 className="text-[15px] font-bold mb-2 mt-3 first:mt-0" {...props} />
	),
	h2: (props: React.ComponentProps<"h2">) => (
		<h2 className="text-[14px] font-bold mb-2 mt-3 first:mt-0" {...props} />
	),
	h3: (props: React.ComponentProps<"h3">) => (
		<h3
			className="text-[13px] font-semibold mb-1 mt-2 first:mt-0"
			{...props}
		/>
	),
	blockquote: (props: React.ComponentProps<"blockquote">) => (
		<blockquote
			className="border-l-2 border-ink-200 pl-3 italic text-ink-500 mb-2"
			{...props}
		/>
	),
	code: (props: React.ComponentProps<"code">) => (
		<code
			className="bg-ink-50 px-1 py-0.5 rounded text-[12px] font-mono"
			{...props}
		/>
	),
};

function RenderedMarkdown({ content }: { content: string }) {
	return (
		<div className="text-[13px] font-sans text-ink-700 leading-relaxed">
			<Markdown components={mdComponents}>{content}</Markdown>
		</div>
	);
}

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
								<RenderedMarkdown content={bullRounds[i]} />
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
								<RenderedMarkdown content={bearRounds[i]} />
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
						<RenderedMarkdown content={debate.judge_verdict} />
					</div>
				</div>
			</div>
		</div>
	);
}
