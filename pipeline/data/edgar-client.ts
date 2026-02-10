import type { Cache } from "./cache";
import { fiscalQuarterEndDate } from "./fiscal-calendar";
import {
  METRIC_MAPPINGS,
  findMetric,
  type MetricMapping,
} from "./metric-mappings";

const SEC_BASE_URL = "https://data.sec.gov/api/xbrl/companyconcept";
const USER_AGENT = "ExecCheck Research research@execcheck.dev";

interface CompanyConceptEntry {
  start?: string;
  end: string;
  val: number;
  fy: number;
  fp: string;
  form: string;
  filed: string;
}

interface CompanyConceptResponse {
  units: Record<string, CompanyConceptEntry[]>;
}

export class EdgarClient {
  constructor(private cache: Cache) {}

  async getFinancialValue(
    ticker: string,
    fiscalYear: number,
    fiscalQuarter: number,
    metric: MetricMapping
  ): Promise<number | null> {
    const cacheKey = `${ticker}-FY${fiscalYear}Q${fiscalQuarter}-${metric.canonicalName}`;
    const cached = this.cache.get("edgar_metrics", cacheKey) as {
      value: number | null;
    } | null;
    if (cached !== null) {
      return cached.value;
    }

    try {
      const value = await this.fetchMetric(
        ticker,
        fiscalYear,
        fiscalQuarter,
        metric
      );
      this.cache.set("edgar_metrics", cacheKey, { value });
      return value;
    } catch (e) {
      console.warn(
        `Failed to fetch ${metric.canonicalName} for ${ticker} FY${fiscalYear}Q${fiscalQuarter}: ${e}`
      );
      this.cache.set("edgar_metrics", cacheKey, { value: null });
      return null;
    }
  }

  private async fetchMetric(
    ticker: string,
    fiscalYear: number,
    fiscalQuarter: number,
    metric: MetricMapping
  ): Promise<number | null> {
    // Handle computed metrics
    if (metric.statement === "computed") {
      return this.computeMetric(ticker, fiscalYear, fiscalQuarter, metric);
    }

    const periodEnd = fiscalQuarterEndDate(ticker, fiscalYear, fiscalQuarter);
    const formType = fiscalQuarter === 4 ? "10-K" : "10-Q";

    // Try each XBRL concept until we find data
    for (const concept of metric.xbrlConcepts) {
      const data = await this.fetchConceptData(ticker, concept);
      if (data === null) continue;

      // Find matching entry
      const match = this.findMatchingEntry(
        data,
        periodEnd,
        formType,
        fiscalQuarter
      );
      if (match !== null) return match;
    }

    return null;
  }

  private async fetchConceptData(
    ticker: string,
    concept: string
  ): Promise<CompanyConceptEntry[] | null> {
    // Cache entire concept response per ticker/concept
    const cacheKey = `${ticker}-${concept}`;
    const cached = this.cache.get(
      "edgar_concepts",
      cacheKey
    ) as CompanyConceptEntry[] | null;
    if (cached !== null) return cached;

    // Look up CIK from companies data
    const { COMPANIES } = await import("./companies");
    const company = COMPANIES.find(
      (c) => c.ticker === ticker.toUpperCase()
    );
    if (!company) return null;

    const cik = company.cik.replace(/^0+/, "");
    const paddedCik = cik.padStart(10, "0");
    const url = `${SEC_BASE_URL}/CIK${paddedCik}/us-gaap/${concept}.json`;

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
      });

      if (!response.ok) {
        if (response.status === 404) {
          this.cache.set("edgar_concepts", cacheKey, []);
          return [];
        }
        throw new Error(`SEC EDGAR API returned ${response.status}`);
      }

      const data = (await response.json()) as CompanyConceptResponse;

      // Flatten all unit types into a single array
      const entries: CompanyConceptEntry[] = [];
      for (const unitEntries of Object.values(data.units)) {
        entries.push(...unitEntries);
      }

      this.cache.set("edgar_concepts", cacheKey, entries);
      return entries;
    } catch (e) {
      console.warn(`Failed to fetch concept ${concept} for ${ticker}: ${e}`);
      return null;
    }
  }

  private findMatchingEntry(
    entries: CompanyConceptEntry[],
    periodEnd: Date,
    formType: string,
    fiscalQuarter: number
  ): number | null {
    const targetDate = this.formatDate(periodEnd);
    const toleranceDays = 5;

    // Try exact form type match first
    for (const entry of entries) {
      if (entry.form !== formType) continue;

      const endDate = new Date(entry.end);
      const daysDiff = Math.abs(
        (endDate.getTime() - periodEnd.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff <= toleranceDays) {
        // For quarterly data (10-Q), check that it spans ~3 months
        if (formType === "10-Q" && entry.start) {
          const startDate = new Date(entry.start);
          const spanDays =
            (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
          if (spanDays > 100) continue; // Skip annual data in 10-Q
        }
        return entry.val;
      }
    }

    // Fallback: try matching by fiscal year/period indicator
    const fpMap: Record<number, string> = {
      1: "Q1",
      2: "Q2",
      3: "Q3",
      4: "FY",
    };
    const targetFp = fpMap[fiscalQuarter] ?? "Q1";

    for (const entry of entries) {
      if (entry.form !== formType) continue;
      if (entry.fp === targetFp) {
        const endDate = new Date(entry.end);
        const daysDiff = Math.abs(
          (endDate.getTime() - periodEnd.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff <= 30) {
          return entry.val;
        }
      }
    }

    return null;
  }

  private async computeMetric(
    ticker: string,
    fiscalYear: number,
    fiscalQuarter: number,
    metric: MetricMapping
  ): Promise<number | null> {
    if (metric.canonicalName === "gross_margin") {
      const gp = await this.getFinancialValue(
        ticker,
        fiscalYear,
        fiscalQuarter,
        findMetric("gross_profit")
      );
      const rev = await this.getFinancialValue(
        ticker,
        fiscalYear,
        fiscalQuarter,
        findMetric("revenue")
      );
      if (gp !== null && rev !== null && rev !== 0) {
        return Math.round((gp / rev) * 10000) / 100;
      }
    } else if (metric.canonicalName === "operating_margin") {
      const oi = await this.getFinancialValue(
        ticker,
        fiscalYear,
        fiscalQuarter,
        findMetric("operating_income")
      );
      const rev = await this.getFinancialValue(
        ticker,
        fiscalYear,
        fiscalQuarter,
        findMetric("revenue")
      );
      if (oi !== null && rev !== null && rev !== 0) {
        return Math.round((oi / rev) * 10000) / 100;
      }
    } else if (metric.canonicalName === "net_margin") {
      const ni = await this.getFinancialValue(
        ticker,
        fiscalYear,
        fiscalQuarter,
        findMetric("net_income")
      );
      const rev = await this.getFinancialValue(
        ticker,
        fiscalYear,
        fiscalQuarter,
        findMetric("revenue")
      );
      if (ni !== null && rev !== null && rev !== 0) {
        return Math.round((ni / rev) * 10000) / 100;
      }
    } else if (metric.canonicalName === "free_cash_flow") {
      const ocf = await this.getFinancialValue(
        ticker,
        fiscalYear,
        fiscalQuarter,
        findMetric("operating_cash_flow")
      );
      const capex = await this.getFinancialValue(
        ticker,
        fiscalYear,
        fiscalQuarter,
        findMetric("capital_expenditures")
      );
      if (ocf !== null && capex !== null) {
        return ocf - Math.abs(capex);
      }
    }

    return null;
  }

  async getAllMetrics(
    ticker: string,
    fiscalYear: number,
    fiscalQuarter: number
  ): Promise<Record<string, number | null>> {
    const results: Record<string, number | null> = {};
    for (const metric of METRIC_MAPPINGS) {
      results[metric.canonicalName] = await this.getFinancialValue(
        ticker,
        fiscalYear,
        fiscalQuarter,
        metric
      );
    }
    return results;
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}
