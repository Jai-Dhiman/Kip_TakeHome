import { describe, expect, test } from "bun:test";
import {
  getAllMetricNames,
  resolveMetric,
} from "../pipeline/data/metric-mappings";

describe("resolveMetric", () => {
  test("exact match revenue", () => {
    const m = resolveMetric("revenue");
    expect(m).not.toBeNull();
    expect(m!.canonicalName).toBe("revenue");
  });

  test("alias match total revenue", () => {
    const m = resolveMetric("total revenue");
    expect(m).not.toBeNull();
    expect(m!.canonicalName).toBe("revenue");
  });

  test("alias match net sales", () => {
    const m = resolveMetric("net sales");
    expect(m).not.toBeNull();
    expect(m!.canonicalName).toBe("revenue");
  });

  test("operating income", () => {
    const m = resolveMetric("operating income");
    expect(m).not.toBeNull();
    expect(m!.canonicalName).toBe("operating_income");
  });

  test("eps basic", () => {
    const m = resolveMetric("earnings per share");
    expect(m).not.toBeNull();
    expect(m!.canonicalName).toBe("eps_basic");
  });

  test("eps diluted", () => {
    const m = resolveMetric("diluted EPS");
    expect(m).not.toBeNull();
    expect(m!.canonicalName).toBe("eps_diluted");
  });

  test("gross margin is computed", () => {
    const m = resolveMetric("gross margin");
    expect(m).not.toBeNull();
    expect(m!.canonicalName).toBe("gross_margin");
    expect(m!.unit).toBe("percentage");
    expect(m!.statement).toBe("computed");
  });

  test("free cash flow is non-GAAP", () => {
    const m = resolveMetric("free cash flow");
    expect(m).not.toBeNull();
    expect(m!.canonicalName).toBe("free_cash_flow");
    expect(m!.isNonGaap).toBe(true);
  });

  test("case insensitive", () => {
    const m = resolveMetric("REVENUE");
    expect(m).not.toBeNull();
    expect(m!.canonicalName).toBe("revenue");
  });

  test("extra whitespace", () => {
    const m = resolveMetric("  total  revenue  ");
    expect(m).not.toBeNull();
    expect(m!.canonicalName).toBe("revenue");
  });

  test("unknown metric returns null", () => {
    const m = resolveMetric("blockchain synergy metric");
    expect(m).toBeNull();
  });

  test("SG&A", () => {
    const m = resolveMetric("SG&A");
    expect(m).not.toBeNull();
    expect(m!.canonicalName).toBe("selling_general_admin");
  });

  test("capex", () => {
    const m = resolveMetric("capex");
    expect(m).not.toBeNull();
    expect(m!.canonicalName).toBe("capital_expenditures");
  });

  test("R&D", () => {
    const m = resolveMetric("R&D");
    expect(m).not.toBeNull();
    expect(m!.canonicalName).toBe("research_and_development");
  });
});

describe("getAllMetricNames", () => {
  test("returns a list", () => {
    const names = getAllMetricNames();
    expect(Array.isArray(names)).toBe(true);
    expect(names.length).toBeGreaterThan(20);
  });

  test("contains key metrics", () => {
    const names = getAllMetricNames();
    expect(names).toContain("revenue");
    expect(names).toContain("net_income");
    expect(names).toContain("eps_diluted");
    expect(names).toContain("operating_margin");
    expect(names).toContain("free_cash_flow");
  });
});
