import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import type { ExtractedClaim, Transcript } from "~/lib/types";
import {
  EXTRACTION_FEW_SHOT,
  EXTRACTION_OUTPUT_SCHEMA,
  EXTRACTION_SYSTEM_PROMPT,
} from "../prompts/extraction";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export async function extractClaims(
  transcript: Transcript,
  model: string = DEFAULT_MODEL,
  apiKey?: string
): Promise<ExtractedClaim[]> {
  const client = new Anthropic(apiKey ? { apiKey } : undefined);

  const transcriptText = formatTranscriptForExtraction(transcript);

  const response = await client.messages.create({
    model,
    max_tokens: 16384,
    system: EXTRACTION_SYSTEM_PROMPT,
    tools: [
      {
        name: "submit_claims",
        description:
          "Submit the extracted financial claims from the transcript.",
        input_schema: EXTRACTION_OUTPUT_SCHEMA as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: "submit_claims" },
    messages: [
      {
        role: "user",
        content: `${EXTRACTION_FEW_SHOT}\n\nNow extract all quantitative claims from the following earnings call transcript for ${transcript.ticker}:\n\n${transcriptText}`,
      },
    ],
  });

  if (response.stop_reason === "max_tokens") {
    console.warn(
      `  WARNING: Extraction response was truncated (max_tokens). Some claims may be missing.`
    );
  }

  const claims: ExtractedClaim[] = [];
  for (const block of response.content) {
    if (block.type === "tool_use" && block.name === "submit_claims") {
      const input = block.input as { claims: RawClaim[] };
      const rawClaims = input.claims ?? [];
      for (const raw of rawClaims) {
        const claim = parseRawClaim(raw, transcript);
        if (claim !== null) {
          claims.push(claim);
        }
      }
    }
  }

  console.log(
    `Extracted ${claims.length} claims from ${transcript.ticker} ${transcript.fiscal_period.ticker}-FY${transcript.fiscal_period.fiscal_year}Q${transcript.fiscal_period.fiscal_quarter}`
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
}

function parseRawClaim(
  raw: RawClaim,
  transcript: Transcript
): ExtractedClaim | null {
  try {
    let claimedValue = raw.claimed_value;
    let claimedUnit = raw.claimed_unit;

    // Normalize: convert USD_billions to USD_millions
    if (claimedUnit === "USD_billions") {
      claimedValue = claimedValue * 1000;
      claimedUnit = "USD_millions";
    }

    const quarterId = `${transcript.ticker}-FY${transcript.fiscal_period.fiscal_year}Q${transcript.fiscal_period.fiscal_quarter}`;

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
    };
  } catch (e) {
    console.warn(
      `Failed to parse claim: ${e} | raw: ${JSON.stringify(raw).slice(0, 200)}`
    );
    return null;
  }
}
