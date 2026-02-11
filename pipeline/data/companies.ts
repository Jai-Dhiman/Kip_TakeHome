import type { Company } from "~/lib/types";

export const COMPANIES: Company[] = [
	{
		ticker: "AAPL",
		name: "Apple Inc.",
		sector: "Technology",
		fiscal_year_end_month: 9,
		cik: "0000320193",
	},
	{
		ticker: "TSLA",
		name: "Tesla, Inc.",
		sector: "Auto/Technology",
		fiscal_year_end_month: 12,
		cik: "0001318605",
	},
	{
		ticker: "MSFT",
		name: "Microsoft Corporation",
		sector: "Technology",
		fiscal_year_end_month: 6,
		cik: "0000789019",
	},
	{
		ticker: "META",
		name: "Meta Platforms, Inc.",
		sector: "Technology",
		fiscal_year_end_month: 12,
		cik: "0001326801",
	},
	{
		ticker: "JPM",
		name: "JPMorgan Chase & Co.",
		sector: "Financials",
		fiscal_year_end_month: 12,
		cik: "0000019617",
	},
	{
		ticker: "COST",
		name: "Costco Wholesale Corporation",
		sector: "Consumer Staples",
		fiscal_year_end_month: 8,
		cik: "0000909832",
	},
	{
		ticker: "CRM",
		name: "Salesforce, Inc.",
		sector: "SaaS",
		fiscal_year_end_month: 1,
		cik: "0001108524",
	},
	{
		ticker: "PFE",
		name: "Pfizer Inc.",
		sector: "Healthcare",
		fiscal_year_end_month: 12,
		cik: "0000078003",
	},
	{
		ticker: "NFLX",
		name: "Netflix, Inc.",
		sector: "Media",
		fiscal_year_end_month: 12,
		cik: "0001065280",
	},
	{
		ticker: "COIN",
		name: "Coinbase Global, Inc.",
		sector: "Fintech",
		fiscal_year_end_month: 12,
		cik: "0001679788",
	},
];

const COMPANY_BY_TICKER: Map<string, Company> = new Map(
	COMPANIES.map((c) => [c.ticker, c]),
);

export function getCompanyProfile(ticker: string): Company {
	const t = ticker.toUpperCase();
	const company = COMPANY_BY_TICKER.get(t);
	if (!company) throw new Error(`Unknown ticker: ${t}`);
	return company;
}
