import { describe, expect, test } from "bun:test";
import {
  fiscalQuarterEndDate,
  fiscalQuarterStartDate,
  getQuarterDates,
  getRecentQuarters,
} from "../pipeline/data/fiscal-calendar";

function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

function datesEqual(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

describe("fiscalQuarterEndDate", () => {
  test("AAPL FY2024 Q1 ends Dec 2023", () => {
    expect(datesEqual(fiscalQuarterEndDate("AAPL", 2024, 1), d(2023, 12, 31))).toBe(true);
  });

  test("AAPL FY2024 Q2 ends Mar 2024", () => {
    expect(datesEqual(fiscalQuarterEndDate("AAPL", 2024, 2), d(2024, 3, 31))).toBe(true);
  });

  test("AAPL FY2024 Q3 ends Jun 2024", () => {
    expect(datesEqual(fiscalQuarterEndDate("AAPL", 2024, 3), d(2024, 6, 30))).toBe(true);
  });

  test("AAPL FY2024 Q4 ends Sep 2024", () => {
    expect(datesEqual(fiscalQuarterEndDate("AAPL", 2024, 4), d(2024, 9, 30))).toBe(true);
  });

  test("MSFT FY2024 Q1 ends Sep 2023", () => {
    expect(datesEqual(fiscalQuarterEndDate("MSFT", 2024, 1), d(2023, 9, 30))).toBe(true);
  });

  test("MSFT FY2024 Q2 ends Dec 2023", () => {
    expect(datesEqual(fiscalQuarterEndDate("MSFT", 2024, 2), d(2023, 12, 31))).toBe(true);
  });

  test("MSFT FY2024 Q3 ends Mar 2024", () => {
    expect(datesEqual(fiscalQuarterEndDate("MSFT", 2024, 3), d(2024, 3, 31))).toBe(true);
  });

  test("MSFT FY2024 Q4 ends Jun 2024", () => {
    expect(datesEqual(fiscalQuarterEndDate("MSFT", 2024, 4), d(2024, 6, 30))).toBe(true);
  });

  test("CRM FY2025 Q1 ends Apr 2024", () => {
    expect(datesEqual(fiscalQuarterEndDate("CRM", 2025, 1), d(2024, 4, 30))).toBe(true);
  });

  test("CRM FY2025 Q2 ends Jul 2024", () => {
    expect(datesEqual(fiscalQuarterEndDate("CRM", 2025, 2), d(2024, 7, 31))).toBe(true);
  });

  test("CRM FY2025 Q3 ends Oct 2024", () => {
    expect(datesEqual(fiscalQuarterEndDate("CRM", 2025, 3), d(2024, 10, 31))).toBe(true);
  });

  test("CRM FY2025 Q4 ends Jan 2025", () => {
    expect(datesEqual(fiscalQuarterEndDate("CRM", 2025, 4), d(2025, 1, 31))).toBe(true);
  });

  test("TSLA calendar year FY2024", () => {
    expect(datesEqual(fiscalQuarterEndDate("TSLA", 2024, 1), d(2024, 3, 31))).toBe(true);
    expect(datesEqual(fiscalQuarterEndDate("TSLA", 2024, 2), d(2024, 6, 30))).toBe(true);
    expect(datesEqual(fiscalQuarterEndDate("TSLA", 2024, 3), d(2024, 9, 30))).toBe(true);
    expect(datesEqual(fiscalQuarterEndDate("TSLA", 2024, 4), d(2024, 12, 31))).toBe(true);
  });

  test("COST FY2024", () => {
    expect(datesEqual(fiscalQuarterEndDate("COST", 2024, 1), d(2023, 11, 30))).toBe(true);
    expect(datesEqual(fiscalQuarterEndDate("COST", 2024, 4), d(2024, 8, 31))).toBe(true);
  });

  test("invalid quarter throws", () => {
    expect(() => fiscalQuarterEndDate("AAPL", 2024, 0)).toThrow();
    expect(() => fiscalQuarterEndDate("AAPL", 2024, 5)).toThrow();
  });

  test("unknown ticker throws", () => {
    expect(() => fiscalQuarterEndDate("UNKNOWN", 2024, 1)).toThrow();
  });
});

describe("fiscalQuarterStartDate", () => {
  test("AAPL FY2024 Q1 starts Oct 1, 2023", () => {
    expect(datesEqual(fiscalQuarterStartDate("AAPL", 2024, 1), d(2023, 10, 1))).toBe(true);
  });

  test("AAPL FY2024 Q2 starts Jan 1, 2024", () => {
    expect(datesEqual(fiscalQuarterStartDate("AAPL", 2024, 2), d(2024, 1, 1))).toBe(true);
  });

  test("TSLA FY2024 Q1 starts Jan 1, 2024", () => {
    expect(datesEqual(fiscalQuarterStartDate("TSLA", 2024, 1), d(2024, 1, 1))).toBe(true);
  });
});

describe("getQuarterDates", () => {
  test("returns full range", () => {
    const qd = getQuarterDates("AAPL", 2024, 2);
    expect(datesEqual(qd.start, d(2024, 1, 1))).toBe(true);
    expect(datesEqual(qd.end, d(2024, 3, 31))).toBe(true);
    expect(qd.fiscal_year).toBe(2024);
    expect(qd.fiscal_quarter).toBe(2);
    expect(qd.ticker).toBe("AAPL");
  });
});

describe("getRecentQuarters", () => {
  test("returns requested count", () => {
    const quarters = getRecentQuarters("TSLA", 4);
    expect(quarters.length).toBeLessThanOrEqual(4);
    expect(quarters.every((q) => q.ticker === "TSLA")).toBe(true);
  });

  test("quarters are chronological (most recent first)", () => {
    const quarters = getRecentQuarters("AAPL", 4);
    for (let i = 0; i < quarters.length - 1; i++) {
      expect(quarters[i]!.end.getTime()).toBeGreaterThan(quarters[i + 1]!.end.getTime());
    }
  });
});
