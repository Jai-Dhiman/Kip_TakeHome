export interface Company {
  ticker: string;
  name: string;
  sector: string;
  fiscal_year_end_month: number;
  cik: string;
}

export interface Quarter {
  id: string;
  ticker: string;
  fiscal_year: number;
  fiscal_quarter: number;
  period_end_date: string;
  transcript_date: string | null;
}

export interface Claim {
  id: string;
  quarter_id: string;
  speaker_name: string;
  speaker_role: string;
  session: "prepared_remarks" | "qa";
  exact_quote: string;
  claim_type: "absolute_value" | "growth_rate" | "margin_or_ratio" | "comparative";
  metric_name: string;
  claimed_value: number;
  claimed_unit: string;
  comparison_basis: string | null;
  gaap_type: "gaap" | "non_gaap" | "ambiguous";
  extraction_confidence: number;
}

export interface Verification {
  claim_id: string;
  status: "verified" | "inaccurate" | "misleading" | "unverifiable";
  actual_value: number | null;
  deviation_absolute: number | null;
  deviation_percentage: number | null;
  edgar_concept: string | null;
  data_source: string | null;
  notes: string | null;
}

export interface MisleadingAssessment {
  claim_id: string;
  tactics: string; // JSON array
  severity: "low" | "medium" | "high";
  explanation: string;
}

export interface Debate {
  quarter_id: string;
  bull_argument: string;
  bear_argument: string;
  judge_verdict: string;
  rounds: number;
}

export interface CredibilityScore {
  quarter_id: string;
  overall_score: number;
  accuracy_score: number;
  framing_score: number;
  consistency_score: number;
  transparency_score: number;
  total_claims: number;
  verified_claims: number;
  inaccurate_claims: number;
  misleading_claims: number;
  unverifiable_claims: number;
  summary: string;
  omitted_metrics: string | null; // JSON array
}

export interface ClaimWithVerification extends Claim {
  verification: Verification | null;
  misleading: MisleadingAssessment | null;
}

export interface CompanyWithScore extends Company {
  latest_score: CredibilityScore | null;
  quarters: QuarterSummary[];
}

export interface QuarterSummary {
  id: string;
  fiscal_year: number;
  fiscal_quarter: number;
  period_end_date: string;
  overall_score: number | null;
  total_claims: number | null;
}

export type ScoreDimension = "accuracy" | "framing" | "consistency" | "transparency";

export const VERDICT_COLORS: Record<Verification["status"], string> = {
  verified: "#22c55e",
  inaccurate: "#ef4444",
  misleading: "#f59e0b",
  unverifiable: "#94a3b8",
};

export const VERDICT_LABELS: Record<Verification["status"], string> = {
  verified: "Verified",
  inaccurate: "Inaccurate",
  misleading: "Misleading",
  unverifiable: "Unverifiable",
};

// --- Pipeline-specific types ---

export type ClaimType = Claim["claim_type"];
export type GaapType = Claim["gaap_type"];
export type VerificationStatus = Verification["status"];
export type Severity = MisleadingAssessment["severity"];

export type MisleadingTactic =
  | "factually_incorrect"
  | "cherry_picking"
  | "gaap_non_gaap_manipulation"
  | "base_period_manipulation"
  | "percentage_vs_absolute"
  | "forward_looking_hedging"
  | "new_metric_introduction"
  | "rounding_inflation";

// Pipeline uses Claim as ExtractedClaim (same shape)
export type ExtractedClaim = Claim;
// Pipeline uses Verification as VerificationResult (same shape)
export type VerificationResult = Verification;

export interface FiscalPeriod {
  ticker: string;
  fiscal_year: number;
  fiscal_quarter: number;
  period_end_date: string;
  transcript_date: string | null;
}

export interface TranscriptSection {
  speaker_name: string;
  speaker_role: string;
  session: string;
  text: string;
}

export interface Transcript {
  ticker: string;
  fiscal_period: FiscalPeriod;
  sections: TranscriptSection[];
  raw_text: string;
}
