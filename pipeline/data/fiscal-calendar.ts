const FISCAL_YEAR_END_MONTHS: Record<string, number> = {
	AAPL: 9, // September
	TSLA: 12, // December
	MSFT: 6, // June
	META: 12, // December
	JPM: 12, // December
	COST: 8, // August
	CRM: 1, // January
	PFE: 12, // December
	NFLX: 12, // December
	COIN: 12, // December
};

export interface QuarterDates {
	start: Date;
	end: Date;
	fiscal_year: number;
	fiscal_quarter: number;
	ticker: string;
}

export function getFiscalYearEndMonth(ticker: string): number {
	const t = ticker.toUpperCase();
	const month = FISCAL_YEAR_END_MONTHS[t];
	if (month === undefined) {
		throw new Error(
			`Unknown ticker: ${t}. Known: ${Object.keys(FISCAL_YEAR_END_MONTHS).join(", ")}`,
		);
	}
	return month;
}

function lastDayOfMonth(year: number, month: number): Date {
	// month is 1-indexed. new Date(year, month, 0) gives last day of that month.
	return new Date(year, month, 0);
}

export function fiscalQuarterEndDate(
	ticker: string,
	fiscalYear: number,
	fiscalQuarter: number,
): Date {
	if (fiscalQuarter < 1 || fiscalQuarter > 4) {
		throw new Error(`fiscal_quarter must be 1-4, got ${fiscalQuarter}`);
	}

	const fyEndMonth = getFiscalYearEndMonth(ticker);

	// Quarter offset from FY end: Q1=-9, Q2=-6, Q3=-3, Q4=0
	const monthOffset = (fiscalQuarter - 4) * 3;

	let targetMonth = fyEndMonth + monthOffset;
	let targetYear = fiscalYear;

	while (targetMonth <= 0) {
		targetMonth += 12;
		targetYear -= 1;
	}
	while (targetMonth > 12) {
		targetMonth -= 12;
		targetYear += 1;
	}

	return lastDayOfMonth(targetYear, targetMonth);
}

export function fiscalQuarterStartDate(
	ticker: string,
	fiscalYear: number,
	fiscalQuarter: number,
): Date {
	if (fiscalQuarter === 1) {
		const priorQ4End = fiscalQuarterEndDate(ticker, fiscalYear - 1, 4);
		return new Date(
			priorQ4End.getFullYear(),
			priorQ4End.getMonth(),
			priorQ4End.getDate() + 1,
		);
	}
	const prevQEnd = fiscalQuarterEndDate(ticker, fiscalYear, fiscalQuarter - 1);
	return new Date(
		prevQEnd.getFullYear(),
		prevQEnd.getMonth(),
		prevQEnd.getDate() + 1,
	);
}

export function getQuarterDates(
	ticker: string,
	fiscalYear: number,
	fiscalQuarter: number,
): QuarterDates {
	return {
		start: fiscalQuarterStartDate(ticker, fiscalYear, fiscalQuarter),
		end: fiscalQuarterEndDate(ticker, fiscalYear, fiscalQuarter),
		fiscal_year: fiscalYear,
		fiscal_quarter: fiscalQuarter,
		ticker,
	};
}

export function getRecentQuarters(
	ticker: string,
	numQuarters: number = 4,
): QuarterDates[] {
	const today = new Date();
	const fyEndMonth = getFiscalYearEndMonth(ticker);

	const currentFy =
		today.getMonth() + 1 > fyEndMonth
			? today.getFullYear() + 1
			: today.getFullYear();

	const quarters: QuarterDates[] = [];
	let fy = currentFy;
	let q = 4;

	while (quarters.length < numQuarters) {
		const end = fiscalQuarterEndDate(ticker, fy, q);
		const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
		if (end <= sixtyDaysAgo) {
			quarters.push(getQuarterDates(ticker, fy, q));
		}
		q -= 1;
		if (q === 0) {
			q = 4;
			fy -= 1;
		}
		if (fy < currentFy - 3) break;
	}

	return quarters;
}
