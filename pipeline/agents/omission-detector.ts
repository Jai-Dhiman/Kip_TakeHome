import type { EdgarClient } from "../data/edgar-client";
import {
  METRIC_MAPPINGS,
  type MetricMapping,
} from "../data/metric-mappings";
import type { ExtractedClaim, Transcript } from "~/lib/types";

// Thresholds for "significant" movement
const REVENUE_CHANGE_THRESHOLD = 5.0;
const MARGIN_CHANGE_THRESHOLD_PP = 1.5;
const DEFAULT_CHANGE_THRESHOLD = 10.0;
const EPS_CHANGE_THRESHOLD = 10.0;

const KEY_METRICS = [
  "revenue",
  "net_income",
  "operating_income",
  "eps_diluted",
  "gross_margin",
  "operating_margin",
  "net_margin",
  "operating_cash_flow",
  "free_cash_flow",
];

interface Mover {
  metric: string;
  displayName: string;
  current: number;
  prior: number;
  change: number;
  isNegative: boolean;
}

export async function detectOmissions(
  transcript: Transcript,
  claims: ExtractedClaim[],
  edgarClient: EdgarClient,
  ticker: string,
  fiscalYear: number,
  fiscalQuarter: number
): Promise<string[]> {
  // Step 1: Get current and prior period metrics
  const currentMetrics = await edgarClient.getAllMetrics(
    ticker,
    fiscalYear,
    fiscalQuarter
  );
  const priorMetrics = await edgarClient.getAllMetrics(
    ticker,
    fiscalYear - 1,
    fiscalQuarter
  );

  // Step 2: Find metrics with significant changes
  const significantMovers = findSignificantMovers(currentMetrics, priorMetrics);

  // Step 3: Check which were discussed in the transcript
  const discussedMetrics = extractDiscussedMetrics(claims, transcript);

  // Step 4: Find omissions
  const omissions: string[] = [];
  for (const mover of significantMovers) {
    if (!wasDiscussed(mover.metric, discussedMetrics)) {
      const direction = mover.change > 0 ? "increased" : "decreased";
      omissions.push(
        `${mover.displayName} ${direction} ${Math.abs(mover.change).toFixed(1)}% YoY ` +
          `(from ${formatValue(mover.prior)} to ${formatValue(mover.current)}) ` +
          `but was not discussed in the earnings call.`
      );
    }
  }

  console.log(
    `Detected ${omissions.length} omissions for ${ticker} FY${fiscalYear}Q${fiscalQuarter}`
  );
  return omissions;
}

function findSignificantMovers(
  current: Record<string, number | null>,
  prior: Record<string, number | null>
): Mover[] {
  const movers: Mover[] = [];

  for (const metric of METRIC_MAPPINGS) {
    const name = metric.canonicalName;
    if (!KEY_METRICS.includes(name)) continue;

    const currVal = current[name];
    const priorVal = prior[name];

    if (currVal == null || priorVal == null || priorVal === 0) continue;

    let pctChange: number;
    let threshold: number;

    if (metric.unit === "percentage") {
      pctChange = currVal - priorVal;
      threshold = MARGIN_CHANGE_THRESHOLD_PP;
    } else {
      pctChange = ((currVal - priorVal) / Math.abs(priorVal)) * 100;
      if (name === "revenue") {
        threshold = REVENUE_CHANGE_THRESHOLD;
      } else if (name === "eps_diluted" || name === "eps_basic") {
        threshold = EPS_CHANGE_THRESHOLD;
      } else {
        threshold = DEFAULT_CHANGE_THRESHOLD;
      }
    }

    const isNegative = pctChange < 0;
    const isSignificant = Math.abs(pctChange) >= threshold;

    if (isSignificant && isNegative) {
      movers.push({
        metric: name,
        displayName: metricDisplayName(metric),
        current: currVal,
        prior: priorVal,
        change: pctChange,
        isNegative,
      });
    }
  }

  movers.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  return movers;
}

function extractDiscussedMetrics(
  claims: ExtractedClaim[],
  transcript: Transcript
): Set<string> {
  const discussed = new Set<string>();

  for (const claim of claims) {
    discussed.add(claim.metric_name.toLowerCase());
  }

  const textLower = transcript.raw_text.toLowerCase();
  for (const metric of METRIC_MAPPINGS) {
    for (const alias of metric.aliases) {
      if (textLower.includes(alias.toLowerCase())) {
        discussed.add(metric.canonicalName);
        break;
      }
    }
  }

  return discussed;
}

function wasDiscussed(metricName: string, discussed: Set<string>): boolean {
  if (discussed.has(metricName)) return true;

  for (const metric of METRIC_MAPPINGS) {
    if (metric.canonicalName === metricName) {
      for (const alias of metric.aliases) {
        if (discussed.has(alias.toLowerCase())) return true;
      }
      break;
    }
  }

  return false;
}

function metricDisplayName(metric: MetricMapping): string {
  return metric.canonicalName
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatValue(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  } else if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  } else if (Math.abs(value) >= 1000) {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  return value.toFixed(2);
}
