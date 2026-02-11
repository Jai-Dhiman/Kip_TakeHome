import { randomUUID } from "crypto";
import type { LLMClient, LLMMessage } from "../ai/llm-client";
import { AnthropicClient } from "../ai/anthropic-client";
import type { ExtractedClaim, Transcript } from "~/lib/types";
import {
  EXTRACTION_FEW_SHOT,
  EXTRACTION_JSON_INSTRUCTION,
  EXTRACTION_OUTPUT_SCHEMA,
  EXTRACTION_SYSTEM_PROMPT,
} from "../prompts/extraction";

export async function extractClaims(
  transcript: Transcript,
  client: LLMClient
): Promise<ExtractedClaim[]> {
  const transcriptText = formatTranscriptForExtraction(transcript);

  const userContent = `${EXTRACTION_FEW_SHOT}\n\nNow extract all quantitative claims from the following earnings call transcript for ${transcript.ticker}:\n\n${transcriptText}`;

  let parsed: { claims: RawClaim[] };

  if (client instanceof AnthropicClient) {
    parsed = await client.chatJSON<{ claims: RawClaim[] }>(
      [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      16384,
      "submit_claims",
      "Submit the extracted financial claims from the transcript.",
      EXTRACTION_OUTPUT_SCHEMA
    );
  } else {
    parsed = await client.chatJSON<{ claims: RawClaim[] }>(
      [
        {
          role: "system",
          content: EXTRACTION_SYSTEM_PROMPT + EXTRACTION_JSON_INSTRUCTION,
        },
        { role: "user", content: userContent },
      ],
      16384
    );
  }

  const allClaims: ExtractedClaim[] = [];
  const rawClaims = parsed.claims ?? [];
  for (const raw of rawClaims) {
    const claim = parseRawClaim(raw, transcript);
    if (claim !== null) {
      allClaims.push(claim);
    }
  }

  // Deduplicate: keep first occurrence per (metric_name, claimed_value, claimed_unit, claim_type)
  const seen = new Set<string>();
  const claims: ExtractedClaim[] = [];
  for (const claim of allClaims) {
    const key = `${claim.metric_name.toLowerCase()}|${claim.claimed_value}|${claim.claimed_unit}|${claim.claim_type}`;
    if (!seen.has(key)) {
      seen.add(key);
      claims.push(claim);
    }
  }

  const dupeCount = allClaims.length - claims.length;
  console.log(
    `Extracted ${claims.length} claims (${dupeCount} duplicates removed) from ${transcript.ticker} ${transcript.fiscal_period.ticker}-FY${transcript.fiscal_period.fiscal_year}Q${transcript.fiscal_period.fiscal_quarter}`
  );
  return claims;
}

function formatTranscriptForExtraction(transcript: Transcript): string {
  const parts: string[] = [];
  for (const section of transcript.sections) {
    parts.push(
      `[${section.speaker_name} | ${section.speaker_role} | ${section.session}]\n${section.text}`
    );
  }
  return parts.join("\n\n---\n\n");
}

interface RawClaim {
  exact_quote: string;
  speaker_name?: string;
  speaker_role?: string;
  session?: string;
  claim_type: string;
  metric_name: string;
  claimed_value: number;
  claimed_unit: string;
  comparison_basis?: string | null;
  gaap_type?: string;
  extraction_confidence?: number;
  verifiable_against_sec_filings?: boolean;
}

// Keywords indicating a metric is NOT verifiable against SEC filings
const NON_VERIFIABLE_KEYWORDS = [
  // Product lines
  "iphone", "ipad", "mac", "watch", "airpods", "vision pro", "homepod", "apple tv", "app store",
  // Segments / cloud / brands
  "services", "wearables", "accessories", "segment", "cloud", "azure", "aws",
  "google cloud", "office", "windows", "linkedin", "gaming", "xbox", "surface", "devices",
  // Non-financial operating metrics
  "subscriber", "user", "customer", "store", "headcount", "employee", "engagement",
  // Forward-looking
  "guidance", "outlook", "forecast",
];

function parseRawClaim(
  raw: RawClaim,
  transcript: Transcript
): ExtractedClaim | null {
  try {
    // Skip claims with missing required fields
    if (raw.claimed_value == null || typeof raw.claimed_value !== "number" || isNaN(raw.claimed_value)) {
      return null;
    }
    if (!raw.exact_quote || !raw.metric_name || !raw.claimed_unit) {
      return null;
    }

    let claimedValue = raw.claimed_value;
    let claimedUnit = raw.claimed_unit;

    // Normalize: convert USD_billions to USD_millions
    if (claimedUnit === "USD_billions") {
      claimedValue = claimedValue * 1000;
      claimedUnit = "USD_millions";
    }

    const quarterId = `${transcript.ticker}-FY${transcript.fiscal_period.fiscal_year}Q${transcript.fiscal_period.fiscal_quarter}`;

    // Rule-based override: force verifiable = false for non-SEC-matchable metrics
    let verifiable = raw.verifiable_against_sec_filings ?? false;
    if (verifiable) {
      const lower = raw.metric_name.toLowerCase();
      if (NON_VERIFIABLE_KEYWORDS.some((kw) => lower.includes(kw))) {
        verifiable = false;
      }
    }

    return {
      id: randomUUID(),
      quarter_id: quarterId,
      speaker_name: raw.speaker_name ?? "Unknown",
      speaker_role: raw.speaker_role ?? "Unknown",
      session: (raw.session as "prepared_remarks" | "qa") ?? "prepared_remarks",
      exact_quote: raw.exact_quote,
      claim_type: raw.claim_type as ExtractedClaim["claim_type"],
      metric_name: raw.metric_name,
      claimed_value: claimedValue,
      claimed_unit: claimedUnit,
      comparison_basis: raw.comparison_basis ?? null,
      gaap_type: (raw.gaap_type as ExtractedClaim["gaap_type"]) ?? "ambiguous",
      extraction_confidence: raw.extraction_confidence ?? 0.5,
      verifiable_against_sec_filings: verifiable,
    };
  } catch (e) {
    console.warn(
      `Failed to parse claim: ${e} | raw: ${JSON.stringify(raw).slice(0, 200)}`
    );
    return null;
  }
}
