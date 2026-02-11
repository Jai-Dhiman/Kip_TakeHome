import { scoreColor } from "~/lib/utils";

export function CredibilityGauge({
	score,
	size = 64,
}: {
	score: number;
	size?: number;
}) {
	const strokeWidth = size * 0.08;
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const progress = (score / 100) * circumference;
	const color = scoreColor(score);

	return (
		<div className="relative" style={{ width: size, height: size }}>
			<svg width={size} height={size} className="-rotate-90">
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="#E0D9CC"
					strokeWidth={strokeWidth}
				/>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke={color}
					strokeWidth={strokeWidth}
					strokeDasharray={`${progress} ${circumference - progress}`}
					strokeLinecap="butt"
					className="transition-all duration-700 ease-out"
				/>
			</svg>
			<div className="absolute inset-0 flex items-center justify-center">
				<span
					className="font-mono font-bold"
					style={{
						fontSize: size * 0.28,
						color,
					}}
				>
					{Math.round(score)}
				</span>
			</div>
		</div>
	);
}
