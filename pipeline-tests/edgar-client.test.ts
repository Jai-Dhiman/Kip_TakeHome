import { describe, expect, test } from "bun:test";
import { EdgarClient } from "../pipeline/data/edgar-client";
import { findMetric } from "../pipeline/data/metric-mappings";

// Minimal mock cache that stores nothing
function makeCache() {
	const store: Record<string, Record<string, unknown>> = {};
	return {
		get(ns: string, key: string) {
			return store[ns]?.[key] ?? null;
		},
		set(ns: string, key: string, val: unknown) {
			if (!store[ns]) store[ns] = {};
			store[ns]![key] = val;
		},
		close() {},
	};
}

// Helper to create XBRL-like entries
function entry(overrides: {
	start?: string;
	end: string;
	val: number;
	fp?: string;
	form?: string;
}) {
	return {
		start: overrides.start,
		end: overrides.end,
		val: overrides.val,
		fy: 2024,
		fp: overrides.fp ?? "FY",
		form: overrides.form ?? "10-K",
		filed: "2024-11-01",
	};
}

describe("findQuarterlyEntryIn10K", () => {
	test("finds quarterly entry with ~90 day span in 10-K", () => {
		const client = new EdgarClient(makeCache() as never);
		const entries = [
			// Annual entry (365 days)
			entry({
				start: "2023-10-01",
				end: "2024-09-28",
				val: 400000000000,
				fp: "FY",
			}),
			// Q4 quarterly entry (~91 days)
			entry({
				start: "2024-06-30",
				end: "2024-09-28",
				val: 102500000000,
				fp: "Q4",
			}),
		];
		const periodEnd = new Date(2024, 8, 28); // Sep 28 2024
		const result = client.findQuarterlyEntryIn10K(entries, periodEnd);
		expect(result).toBe(102500000000);
	});

	test("returns null when no quarterly entry exists", () => {
		const client = new EdgarClient(makeCache() as never);
		const entries = [
			// Only annual entry
			entry({
				start: "2023-10-01",
				end: "2024-09-28",
				val: 400000000000,
				fp: "FY",
			}),
		];
		const periodEnd = new Date(2024, 8, 28);
		const result = client.findQuarterlyEntryIn10K(entries, periodEnd);
		expect(result).toBeNull();
	});

	test("ignores entries with wrong date", () => {
		const client = new EdgarClient(makeCache() as never);
		const entries = [
			// Quarterly entry for a different quarter
			entry({
				start: "2024-01-01",
				end: "2024-03-30",
				val: 90000000000,
				fp: "Q2",
				form: "10-K",
			}),
		];
		const periodEnd = new Date(2024, 8, 28);
		const result = client.findQuarterlyEntryIn10K(entries, periodEnd);
		expect(result).toBeNull();
	});

	test("ignores 10-Q entries", () => {
		const client = new EdgarClient(makeCache() as never);
		const entries = [
			entry({
				start: "2024-06-30",
				end: "2024-09-28",
				val: 102500000000,
				fp: "Q4",
				form: "10-Q",
			}),
		];
		const periodEnd = new Date(2024, 8, 28);
		const result = client.findQuarterlyEntryIn10K(entries, periodEnd);
		expect(result).toBeNull();
	});
});

describe("findAnnualEntryIn10K", () => {
	test("finds entry with fp=FY", () => {
		const client = new EdgarClient(makeCache() as never);
		const entries = [
			entry({
				start: "2023-10-01",
				end: "2024-09-28",
				val: 416200000000,
				fp: "FY",
			}),
			entry({
				start: "2024-06-30",
				end: "2024-09-28",
				val: 102500000000,
				fp: "Q4",
			}),
		];
		const periodEnd = new Date(2024, 8, 28);
		const result = client.findAnnualEntryIn10K(entries, periodEnd);
		expect(result).toBe(416200000000);
	});

	test("finds entry with >350 day span", () => {
		const client = new EdgarClient(makeCache() as never);
		const entries = [
			entry({
				start: "2023-10-01",
				end: "2024-09-28",
				val: 416200000000,
				fp: "Q4",
			}), // FP mislabeled but span is annual
		];
		const periodEnd = new Date(2024, 8, 28);
		// This has fp=Q4, but span is ~363 days which is > 350
		const result = client.findAnnualEntryIn10K(entries, periodEnd);
		expect(result).toBe(416200000000);
	});

	test("returns null when no annual entry found", () => {
		const client = new EdgarClient(makeCache() as never);
		const entries = [
			// Only a quarterly entry
			entry({
				start: "2024-06-30",
				end: "2024-09-28",
				val: 102500000000,
				fp: "Q4",
			}),
		];
		const periodEnd = new Date(2024, 8, 28);
		const result = client.findAnnualEntryIn10K(entries, periodEnd);
		expect(result).toBeNull();
	});
});

describe("computeQ4ByDecomposition", () => {
	test("correctly decomposes Q4 = annual - Q1 - Q2 - Q3", async () => {
		const cache = makeCache();
		const client = new EdgarClient(cache as never);

		const revenueMetric = findMetric("revenue");
		const concept = revenueMetric.xbrlConcepts[0]!;

		// Pre-populate concept data cache with entries for AAPL (Sept FY end)
		// Annual: $416.2B, Q1: $119.6B, Q2: $94.9B, Q3: $99.2B -> Q4 = $102.5B
		const mockEntries = [
			// Annual (10-K, FY, Sep 28 2024)
			entry({
				start: "2023-10-01",
				end: "2024-09-28",
				val: 416200000000,
				fp: "FY",
				form: "10-K",
			}),
			// Q1 (10-Q, Dec 30 2023)
			entry({
				start: "2023-10-01",
				end: "2023-12-30",
				val: 119600000000,
				fp: "Q1",
				form: "10-Q",
			}),
			// Q2 (10-Q, Mar 30 2024)
			entry({
				start: "2024-01-01",
				end: "2024-03-30",
				val: 94900000000,
				fp: "Q2",
				form: "10-Q",
			}),
			// Q3 (10-Q, Jun 29 2024)
			entry({
				start: "2024-04-01",
				end: "2024-06-29",
				val: 99200000000,
				fp: "Q3",
				form: "10-Q",
			}),
		];

		cache.set("edgar_concepts", `AAPL-${concept}`, mockEntries);

		const result = await client.computeQ4ByDecomposition(
			"AAPL",
			2024,
			revenueMetric,
		);
		expect(result).toBe(
			416200000000 - 119600000000 - 94900000000 - 99200000000,
		);
		expect(result).toBe(102500000000);
	});

	test("returns null for EPS (non-additive)", async () => {
		const cache = makeCache();
		const client = new EdgarClient(cache as never);
		const epsMetric = findMetric("eps_diluted");

		const result = await client.computeQ4ByDecomposition(
			"AAPL",
			2024,
			epsMetric,
		);
		expect(result).toBeNull();
	});

	test("returns null for shares_outstanding (non-additive)", async () => {
		const cache = makeCache();
		const client = new EdgarClient(cache as never);
		const sharesMetric = findMetric("shares_outstanding");

		const result = await client.computeQ4ByDecomposition(
			"AAPL",
			2024,
			sharesMetric,
		);
		expect(result).toBeNull();
	});

	test("returns null when Q3 data is missing", async () => {
		const cache = makeCache();
		const client = new EdgarClient(cache as never);

		const revenueMetric = findMetric("revenue");
		const concept = revenueMetric.xbrlConcepts[0]!;

		// Only annual + Q1 + Q2, no Q3
		const mockEntries = [
			entry({
				start: "2023-10-01",
				end: "2024-09-28",
				val: 416200000000,
				fp: "FY",
				form: "10-K",
			}),
			entry({
				start: "2023-10-01",
				end: "2023-12-30",
				val: 119600000000,
				fp: "Q1",
				form: "10-Q",
			}),
			entry({
				start: "2024-01-01",
				end: "2024-03-30",
				val: 94900000000,
				fp: "Q2",
				form: "10-Q",
			}),
		];

		cache.set("edgar_concepts", `AAPL-${concept}`, mockEntries);

		const result = await client.computeQ4ByDecomposition(
			"AAPL",
			2024,
			revenueMetric,
		);
		expect(result).toBeNull();
	});

	test("returns null when annual data is missing", async () => {
		const cache = makeCache();
		const client = new EdgarClient(cache as never);

		const revenueMetric = findMetric("revenue");
		const concept = revenueMetric.xbrlConcepts[0]!;

		// Only quarterly, no annual
		const mockEntries = [
			entry({
				start: "2023-10-01",
				end: "2023-12-30",
				val: 119600000000,
				fp: "Q1",
				form: "10-Q",
			}),
			entry({
				start: "2024-01-01",
				end: "2024-03-30",
				val: 94900000000,
				fp: "Q2",
				form: "10-Q",
			}),
			entry({
				start: "2024-04-01",
				end: "2024-06-29",
				val: 99200000000,
				fp: "Q3",
				form: "10-Q",
			}),
		];

		cache.set("edgar_concepts", `AAPL-${concept}`, mockEntries);

		const result = await client.computeQ4ByDecomposition(
			"AAPL",
			2024,
			revenueMetric,
		);
		expect(result).toBeNull();
	});
});

describe("balance sheet Q4 uses 10-K directly", () => {
	test("isPointInTime metrics use 10-K value without decomposition", () => {
		const totalAssets = findMetric("total_assets");
		expect(totalAssets.isPointInTime).toBe(true);
		expect(totalAssets.statement).toBe("balance_sheet");
	});

	test("income metrics are not point-in-time", () => {
		const revenue = findMetric("revenue");
		expect(revenue.isPointInTime).toBe(false);
		expect(revenue.statement).toBe("income");
	});

	test("cash flow metrics are not point-in-time", () => {
		const ocf = findMetric("operating_cash_flow");
		expect(ocf.isPointInTime).toBe(false);
		expect(ocf.statement).toBe("cash_flow");
	});
});
