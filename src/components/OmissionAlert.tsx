export function OmissionAlert({ text }: { text: string }) {
	return (
		<div className="omission-alert flex items-start gap-2">
			<span
				className="shrink-0 mt-0.5 font-serif text-sm font-bold"
				style={{ color: "#C48B20" }}
			>
				!
			</span>
			<p className="text-[13px] font-sans text-ink-600 leading-relaxed">
				{text}
			</p>
		</div>
	);
}
