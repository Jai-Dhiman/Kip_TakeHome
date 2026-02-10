export function formatScore(score: number): string {
  return Math.round(score).toString();
}

export function scoreColor(score: number): string {
  if (score >= 90) return "#22c55e";
  if (score >= 70) return "#84cc16";
  if (score >= 50) return "#f59e0b";
  if (score >= 30) return "#f97316";
  return "#ef4444";
}

export function scoreLabel(score: number): string {
  if (score >= 90) return "Exemplary";
  if (score >= 70) return "Reliable";
  if (score >= 50) return "Mixed";
  if (score >= 30) return "Concerning";
  return "Unreliable";
}

export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export function formatQuarter(fiscalYear: number, fiscalQuarter: number): string {
  return `FY${fiscalYear} Q${fiscalQuarter}`;
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
