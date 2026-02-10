import type { EdgarClient } from "../data/edgar-client";
import { resolveMetric, type MetricMapping } from "../data/metric-mappings";
import type {
  ExtractedClaim,
  MisleadingAssessment,
  MisleadingTactic,
  Severity,
  VerificationResult,
  VerificationStatus,
} from "~/lib/types";

// Tolerance bands for verification
const ABSOLUTE_VALUE_TOLERANCE_PCT = 0.5;
const GROWTH_RATE_TOLERANCE_PP = 0.3;
const MARGIN_TOLERANCE_PP = 0.3;
const ROUNDING_THRESHOLD_PCT = 2.0;

export class VerificationEngine {
  constructor(private edgar: EdgarClient) {}

  async verifyClaim(
    claim: ExtractedClaim,
    fiscalYear: number,
    fiscalQuarter: number,
    ticker: string
  ): Promise<[VerificationResult, MisleadingAssessment | null]> {
    // Step 1: Resolve metric
    const metric = resolveMetric(claim.metric_name);
    if (metric === null) {
      return [
        {
          claim_id: claim.id,
          status: "unverifiable" as VerificationStatus,
          actual_value: null,
          deviation_absolute: null,
          deviation_percentage: null,
          edgar_concept: null,
          data_source: null,
          notes: `Could not resolve metric: ${claim.metric_name}`,
        },
        null,
      ];
    }

    // Step 2: Fetch actual value
    const actualValue = await this.edgar.getFinancialValue(
      ticker,
      fiscalYear,
      fiscalQuarter,
      metric
    );

    if (actualValue === null) {
      return [
        {
          claim_id: claim.id,
          status: "unverifiable" as VerificationStatus,
          actual_value: null,
          deviation_absolute: null,
          deviation_percentage: null,
          edgar_concept:
            metric.xbrlConcepts.length > 0 ? metric.xbrlConcepts[0]! : null,
          data_source: null,
          notes: `No EDGAR data found for ${metric.canonicalName}`,
        },
        null,
      ];
    }

    // Step 3: Normalize and compare
    if (claim.claim_type === "growth_rate") {
      return this.verifyGrowthRate(
        claim,
        metric,
        actualValue,
        ticker,
        fiscalYear,
        fiscalQuarter
      );
    } else if (claim.claim_type === "margin_or_ratio") {
      return this.verifyMargin(claim, metric, actualValue);
    } else {
      return this.verifyAbsolute(claim, metric, actualValue);
    }
  }

  private verifyAbsolute(
    claim: ExtractedClaim,
    metric: MetricMapping,
    actualValue: number
  ): [VerificationResult, MisleadingAssessment | null] {
    const claimed = claim.claimed_value;

    let actualForComparison: number;
    if (claim.claimed_unit === "USD_millions") {
      actualForComparison =
        Math.abs(actualValue) > 1_000_000
          ? actualValue / 1_000_000
          : actualValue;
    } else {
      actualForComparison = actualValue;
    }

    const deviationPct =
      actualForComparison === 0
        ? claimed !== 0
          ? 100.0
          : 0.0
        : (Math.abs(claimed - actualForComparison) /
            Math.abs(actualForComparison)) *
          100;

    const deviationAbs = claimed - actualForComparison;

    let status: VerificationStatus;
    let assessment: MisleadingAssessment | null = null;
    const tactics: MisleadingTactic[] = [];

    if (deviationPct <= ABSOLUTE_VALUE_TOLERANCE_PCT) {
      status = "verified";
    } else if (deviationPct <= ROUNDING_THRESHOLD_PCT) {
      if (
        (claimed > actualForComparison && claimed > 0) ||
        (claimed < actualForComparison && claimed < 0)
      ) {
        status = "misleading";
        tactics.push("rounding_inflation");
        assessment = {
          claim_id: claim.id,
          tactics: JSON.stringify(tactics),
          severity: "low",
          explanation: `Claimed ${claimed} vs actual ${actualForComparison.toFixed(2)} (${deviationPct.toFixed(1)}% deviation). Rounded in the direction that flatters the narrative.`,
        };
      } else {
        status = "verified";
      }
    } else {
      status = "inaccurate";
      tactics.push("factually_incorrect");
      const severity: Severity = deviationPct > 5 ? "high" : "medium";
      assessment = {
        claim_id: claim.id,
        tactics: JSON.stringify(tactics),
        severity,
        explanation: `Claimed ${claimed} vs actual ${actualForComparison.toFixed(2)} (${deviationPct.toFixed(1)}% deviation). Beyond acceptable tolerance.`,
      };
    }

    // Check GAAP/non-GAAP mismatch
    if (claim.gaap_type === "ambiguous" && metric.isNonGaap) {
      if (assessment === null) {
        assessment = {
          claim_id: claim.id,
          tactics: JSON.stringify(["gaap_non_gaap_manipulation"]),
          severity: "medium",
          explanation:
            "Metric presented without GAAP/non-GAAP clarification, but the value appears to be non-GAAP.",
        };
      } else {
        const existingTactics: string[] = JSON.parse(assessment.tactics);
        existingTactics.push("gaap_non_gaap_manipulation");
        assessment.tactics = JSON.stringify(existingTactics);
      }
    }

    return [
      {
        claim_id: claim.id,
        status,
        actual_value: actualForComparison,
        deviation_absolute: deviationAbs,
        deviation_percentage: deviationPct,
        edgar_concept:
          metric.xbrlConcepts.length > 0 ? metric.xbrlConcepts[0]! : null,
        data_source: "SEC EDGAR XBRL",
        notes: null,
      },
      assessment,
    ];
  }

  private async verifyGrowthRate(
    claim: ExtractedClaim,
    metric: MetricMapping,
    currentValue: number,
    ticker: string,
    fiscalYear: number,
    fiscalQuarter: number
  ): Promise<[VerificationResult, MisleadingAssessment | null]> {
    let priorFy: number;
    let priorFq: number;

    if (
      claim.comparison_basis &&
      claim.comparison_basis.toLowerCase().includes("year")
    ) {
      priorFy = fiscalYear - 1;
      priorFq = fiscalQuarter;
    } else if (
      claim.comparison_basis &&
      (claim.comparison_basis.toLowerCase().includes("sequential") ||
        claim.comparison_basis.toLowerCase().includes("quarter"))
    ) {
      if (fiscalQuarter === 1) {
        priorFy = fiscalYear - 1;
        priorFq = 4;
      } else {
        priorFy = fiscalYear;
        priorFq = fiscalQuarter - 1;
      }
    } else {
      // Default to year-over-year
      priorFy = fiscalYear - 1;
      priorFq = fiscalQuarter;
    }

    const priorValue = await this.edgar.getFinancialValue(
      ticker,
      priorFy,
      priorFq,
      metric
    );
    if (priorValue === null || priorValue === 0) {
      return [
        {
          claim_id: claim.id,
          status: "unverifiable" as VerificationStatus,
          actual_value: currentValue,
          deviation_absolute: null,
          deviation_percentage: null,
          edgar_concept:
            metric.xbrlConcepts.length > 0 ? metric.xbrlConcepts[0]! : null,
          data_source: null,
          notes: `Could not fetch prior period (${priorFy} Q${priorFq}) for growth comparison`,
        },
        null,
      ];
    }

    const currentNorm =
      Math.abs(currentValue) > 1_000_000
        ? currentValue / 1_000_000
        : currentValue;
    const priorNorm =
      Math.abs(priorValue) > 1_000_000
        ? priorValue / 1_000_000
        : priorValue;

    const actualGrowth =
      ((currentNorm - priorNorm) / Math.abs(priorNorm)) * 100;
    const deviationPp = Math.abs(claim.claimed_value - actualGrowth);

    let status: VerificationStatus;
    let assessment: MisleadingAssessment | null = null;
    const tactics: MisleadingTactic[] = [];

    if (deviationPp <= GROWTH_RATE_TOLERANCE_PP) {
      status = "verified";
    } else if (deviationPp <= 1.0) {
      status = "misleading";
      tactics.push("rounding_inflation");
      assessment = {
        claim_id: claim.id,
        tactics: JSON.stringify(tactics),
        severity: "low",
        explanation: `Claimed ${claim.claimed_value}% growth vs actual ${actualGrowth.toFixed(1)}% (${deviationPp.toFixed(1)}pp deviation).`,
      };
    } else {
      status = "inaccurate";
      tactics.push("factually_incorrect");
      assessment = {
        claim_id: claim.id,
        tactics: JSON.stringify(tactics),
        severity: deviationPp > 3 ? "high" : "medium",
        explanation: `Claimed ${claim.claimed_value}% growth vs actual ${actualGrowth.toFixed(1)}% (${deviationPp.toFixed(1)}pp deviation).`,
      };
    }

    return [
      {
        claim_id: claim.id,
        status,
        actual_value: actualGrowth,
        deviation_absolute: claim.claimed_value - actualGrowth,
        deviation_percentage: deviationPp,
        edgar_concept:
          metric.xbrlConcepts.length > 0 ? metric.xbrlConcepts[0]! : null,
        data_source: "SEC EDGAR XBRL (computed growth rate)",
        notes: `Current: ${currentNorm.toFixed(2)}, Prior: ${priorNorm.toFixed(2)}`,
      },
      assessment,
    ];
  }

  private verifyMargin(
    claim: ExtractedClaim,
    metric: MetricMapping,
    actualValue: number
  ): [VerificationResult, MisleadingAssessment | null] {
    const claimed = claim.claimed_value;
    const actual = actualValue;
    const deviationPp = Math.abs(claimed - actual);

    let status: VerificationStatus;
    let assessment: MisleadingAssessment | null = null;
    const tactics: MisleadingTactic[] = [];

    if (deviationPp <= MARGIN_TOLERANCE_PP) {
      status = "verified";
    } else if (deviationPp <= 1.0) {
      status = "misleading";
      tactics.push("rounding_inflation");
      assessment = {
        claim_id: claim.id,
        tactics: JSON.stringify(tactics),
        severity: "low",
        explanation: `Claimed ${claimed}% vs actual ${actual.toFixed(1)}% (${deviationPp.toFixed(1)}pp deviation).`,
      };
    } else {
      status = "inaccurate";
      tactics.push("factually_incorrect");
      assessment = {
        claim_id: claim.id,
        tactics: JSON.stringify(tactics),
        severity: deviationPp > 5 ? "high" : "medium",
        explanation: `Claimed ${claimed}% vs actual ${actual.toFixed(1)}% (${deviationPp.toFixed(1)}pp deviation).`,
      };
    }

    return [
      {
        claim_id: claim.id,
        status,
        actual_value: actual,
        deviation_absolute: claimed - actual,
        deviation_percentage: deviationPp,
        edgar_concept:
          metric.xbrlConcepts.length > 0 ? metric.xbrlConcepts[0]! : null,
        data_source: "SEC EDGAR XBRL (computed ratio)",
        notes: null,
      },
      assessment,
    ];
  }

  async verifyAllClaims(
    claims: ExtractedClaim[],
    ticker: string,
    fiscalYear: number,
    fiscalQuarter: number
  ): Promise<[VerificationResult[], MisleadingAssessment[]]> {
    const verifications: VerificationResult[] = [];
    const assessments: MisleadingAssessment[] = [];

    for (const claim of claims) {
      const [verification, assessment] = await this.verifyClaim(
        claim,
        fiscalYear,
        fiscalQuarter,
        ticker
      );
      verifications.push(verification);
      if (assessment !== null) {
        assessments.push(assessment);
      }
    }

    const verified = verifications.filter(
      (v) => v.status === "verified"
    ).length;
    const inaccurate = verifications.filter(
      (v) => v.status === "inaccurate"
    ).length;
    const misleading = verifications.filter(
      (v) => v.status === "misleading"
    ).length;
    const unverifiable = verifications.filter(
      (v) => v.status === "unverifiable"
    ).length;

    console.log(
      `Verified ${claims.length} claims for ${ticker} FY${fiscalYear}Q${fiscalQuarter}: ` +
        `${verified} verified, ${inaccurate} inaccurate, ${misleading} misleading, ${unverifiable} unverifiable`
    );

    return [verifications, assessments];
  }
}
