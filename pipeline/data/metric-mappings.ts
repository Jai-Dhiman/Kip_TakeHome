export interface MetricMapping {
	canonicalName: string;
	aliases: string[];
	xbrlConcepts: string[];
	unit: string;
	statement: string; // "income" | "balance_sheet" | "cash_flow" | "computed"
	isNonGaap: boolean;
	isPointInTime: boolean;
}

export const METRIC_MAPPINGS: MetricMapping[] = [
	// --- Income Statement ---
	{
		canonicalName: "revenue",
		aliases: [
			"revenue",
			"total revenue",
			"net revenue",
			"net sales",
			"total net revenue",
			"sales",
			"total net sales",
			"net revenues",
		],
		xbrlConcepts: [
			"RevenueFromContractWithCustomerExcludingAssessedTax",
			"Revenues",
			"RevenueFromContractWithCustomerIncludingAssessedTax",
			"SalesRevenueNet",
			"TotalRevenuesAndOtherIncome",
		],
		unit: "USD",
		statement: "income",
		isNonGaap: false,
		isPointInTime: false,
	},
	{
		canonicalName: "cost_of_revenue",
		aliases: ["cost of revenue", "cost of sales", "cost of goods sold", "cogs"],
		xbrlConcepts: [
			"CostOfGoodsAndServicesSold",
			"CostOfRevenue",
			"CostOfGoodsSold",
		],
		unit: "USD",
		statement: "income",
		isNonGaap: false,
		isPointInTime: false,
	},
	{
		canonicalName: "gross_profit",
		aliases: ["gross profit", "gross margin dollars"],
		xbrlConcepts: ["GrossProfit"],
		unit: "USD",
		statement: "income",
		isNonGaap: false,
		isPointInTime: false,
	},
	{
		canonicalName: "operating_income",
		aliases: [
			"operating income",
			"income from operations",
			"operating profit",
			"EBIT",
		],
		xbrlConcepts: [
			"OperatingIncomeLoss",
			"IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
		],
		unit: "USD",
		statement: "income",
		isNonGaap: false,
		isPointInTime: false,
	},
	{
		canonicalName: "net_income",
		aliases: [
			"net income",
			"net earnings",
			"net profit",
			"bottom line",
			"net income attributable to common stockholders",
		],
		xbrlConcepts: [
			"NetIncomeLoss",
			"ProfitLoss",
			"NetIncomeLossAvailableToCommonStockholdersBasic",
		],
		unit: "USD",
		statement: "income",
		isNonGaap: false,
		isPointInTime: false,
	},
	{
		canonicalName: "eps_basic",
		aliases: [
			"earnings per share",
			"EPS",
			"basic EPS",
			"basic earnings per share",
		],
		xbrlConcepts: ["EarningsPerShareBasic"],
		unit: "USD/share",
		statement: "income",
		isNonGaap: false,
		isPointInTime: false,
	},
	{
		canonicalName: "eps_diluted",
		aliases: ["diluted EPS", "diluted earnings per share", "eps diluted"],
		xbrlConcepts: ["EarningsPerShareDiluted"],
		unit: "USD/share",
		statement: "income",
		isNonGaap: false,
		isPointInTime: false,
	},
	{
		canonicalName: "research_and_development",
		aliases: [
			"R&D",
			"research and development",
			"R&D expense",
			"research and development expense",
		],
		xbrlConcepts: ["ResearchAndDevelopmentExpense"],
		unit: "USD",
		statement: "income",
		isNonGaap: false,
		isPointInTime: false,
	},
	{
		canonicalName: "selling_general_admin",
		aliases: [
			"SG&A",
			"selling general and administrative",
			"selling and marketing",
		],
		xbrlConcepts: ["SellingGeneralAndAdministrativeExpense"],
		unit: "USD",
		statement: "income",
		isNonGaap: false,
		isPointInTime: false,
	},
	{
		canonicalName: "operating_expenses",
		aliases: ["operating expenses", "total operating expenses", "opex"],
		xbrlConcepts: ["OperatingExpenses", "CostsAndExpenses"],
		unit: "USD",
		statement: "income",
		isNonGaap: false,
		isPointInTime: false,
	},
	{
		canonicalName: "interest_expense",
		aliases: ["interest expense", "interest cost"],
		xbrlConcepts: ["InterestExpense", "InterestExpenseDebt"],
		unit: "USD",
		statement: "income",
		isNonGaap: false,
		isPointInTime: false,
	},
	{
		canonicalName: "income_tax_expense",
		aliases: ["income tax", "tax expense", "provision for income taxes"],
		xbrlConcepts: ["IncomeTaxExpenseBenefit"],
		unit: "USD",
		statement: "income",
		isNonGaap: false,
		isPointInTime: false,
	},
	// --- Margins (computed) ---
	{
		canonicalName: "gross_margin",
		aliases: ["gross margin", "gross profit margin"],
		xbrlConcepts: [], // Computed: gross_profit / revenue
		unit: "percentage",
		statement: "computed",
		isNonGaap: false,
		isPointInTime: false,
	},
	{
		canonicalName: "operating_margin",
		aliases: ["operating margin", "op margin"],
		xbrlConcepts: [], // Computed: operating_income / revenue
		unit: "percentage",
		statement: "computed",
		isNonGaap: false,
		isPointInTime: false,
	},
	{
		canonicalName: "net_margin",
		aliases: ["net margin", "profit margin", "net income margin"],
		xbrlConcepts: [], // Computed: net_income / revenue
		unit: "percentage",
		statement: "computed",
		isNonGaap: false,
		isPointInTime: false,
	},
	// --- Balance Sheet ---
	{
		canonicalName: "total_assets",
		aliases: ["total assets"],
		xbrlConcepts: ["Assets"],
		unit: "USD",
		statement: "balance_sheet",
		isNonGaap: false,
		isPointInTime: true,
	},
	{
		canonicalName: "total_liabilities",
		aliases: ["total liabilities"],
		xbrlConcepts: ["Liabilities"],
		unit: "USD",
		statement: "balance_sheet",
		isNonGaap: false,
		isPointInTime: true,
	},
	{
		canonicalName: "total_equity",
		aliases: [
			"total equity",
			"stockholders equity",
			"shareholders equity",
			"total stockholders equity",
		],
		xbrlConcepts: [
			"StockholdersEquity",
			"StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
		],
		unit: "USD",
		statement: "balance_sheet",
		isNonGaap: false,
		isPointInTime: true,
	},
	{
		canonicalName: "cash_and_equivalents",
		aliases: [
			"cash",
			"cash and equivalents",
			"cash and cash equivalents",
			"cash and short-term investments",
		],
		xbrlConcepts: [
			"CashAndCashEquivalentsAtCarryingValue",
			"CashCashEquivalentsAndShortTermInvestments",
		],
		unit: "USD",
		statement: "balance_sheet",
		isNonGaap: false,
		isPointInTime: true,
	},
	{
		canonicalName: "total_debt",
		aliases: [
			"total debt",
			"long-term debt",
			"debt",
			"long term debt",
			"term debt",
		],
		xbrlConcepts: ["LongTermDebt", "LongTermDebtNoncurrent", "DebtCurrent"],
		unit: "USD",
		statement: "balance_sheet",
		isNonGaap: false,
		isPointInTime: true,
	},
	// --- Cash Flow ---
	{
		canonicalName: "operating_cash_flow",
		aliases: [
			"operating cash flow",
			"cash from operations",
			"cash flow from operations",
			"CFO",
			"cash provided by operating activities",
			"net cash from operations",
		],
		xbrlConcepts: ["NetCashProvidedByUsedInOperatingActivities"],
		unit: "USD",
		statement: "cash_flow",
		isNonGaap: false,
		isPointInTime: false,
	},
	{
		canonicalName: "capital_expenditures",
		aliases: [
			"capex",
			"capital expenditures",
			"capital spending",
			"purchases of property and equipment",
		],
		xbrlConcepts: [
			"PaymentsToAcquirePropertyPlantAndEquipment",
			"PaymentsToAcquireProductiveAssets",
		],
		unit: "USD",
		statement: "cash_flow",
		isNonGaap: false,
		isPointInTime: false,
	},
	{
		canonicalName: "free_cash_flow",
		aliases: ["free cash flow", "FCF"],
		xbrlConcepts: [], // Computed: operating_cash_flow - capex
		unit: "USD",
		statement: "computed",
		isNonGaap: true,
		isPointInTime: false,
	},
	{
		canonicalName: "share_repurchases",
		aliases: [
			"share repurchases",
			"stock buyback",
			"buybacks",
			"repurchase of common stock",
		],
		xbrlConcepts: ["PaymentsForRepurchaseOfCommonStock"],
		unit: "USD",
		statement: "cash_flow",
		isNonGaap: false,
		isPointInTime: false,
	},
	{
		canonicalName: "dividends_paid",
		aliases: [
			"dividends",
			"dividends paid",
			"cash dividends",
			"dividend payments",
			"cash dividends paid",
		],
		xbrlConcepts: ["PaymentsOfDividendsCommonStock", "PaymentsOfDividends"],
		unit: "USD",
		statement: "cash_flow",
		isNonGaap: false,
		isPointInTime: false,
	},
	// --- Per-share metrics ---
	{
		canonicalName: "shares_outstanding",
		aliases: [
			"shares outstanding",
			"weighted average shares",
			"diluted shares",
		],
		xbrlConcepts: [
			"WeightedAverageNumberOfDilutedSharesOutstanding",
			"WeightedAverageNumberOfShareOutstandingBasicAndDiluted",
			"CommonStockSharesOutstanding",
		],
		unit: "shares",
		statement: "income",
		isNonGaap: false,
		isPointInTime: false,
	},
];

function normalize(text: string): string {
	return text.toLowerCase().trim().split(/\s+/).join(" ");
}

const ALIAS_INDEX: Map<string, MetricMapping> = new Map();
for (const m of METRIC_MAPPINGS) {
	for (const alias of m.aliases) {
		ALIAS_INDEX.set(normalize(alias), m);
	}
}

export function resolveMetric(
	naturalLanguageName: string,
): MetricMapping | null {
	const normalized = normalize(naturalLanguageName);
	return ALIAS_INDEX.get(normalized) ?? null;
}

export function getAllMetricNames(): string[] {
	return METRIC_MAPPINGS.map((m) => m.canonicalName);
}

export function findMetric(canonicalName: string): MetricMapping {
	const m = METRIC_MAPPINGS.find((m) => m.canonicalName === canonicalName);
	if (!m) throw new Error(`Unknown metric: ${canonicalName}`);
	return m;
}
