export const EXTRACTION_SYSTEM_PROMPT = `You are a financial claim extraction specialist. Your job is to extract quantitative claims from earnings call transcripts.

A "claim" is any specific, verifiable numerical statement about financial performance. Extract claims that include:
- Specific dollar amounts (revenue, net income, expenses, etc.)
- Percentages (margins, growth rates, market share)
- Per-share figures (EPS)
- Growth comparisons (year-over-year, quarter-over-quarter)

For each claim, extract:
1. exact_quote: The exact sentence or phrase containing the claim
2. speaker_name: Who made the claim
3. speaker_role: Their role (CEO, CFO, etc.)
4. session: "prepared_remarks" or "qa"
5. claim_type: One of "absolute_value", "growth_rate", "margin_or_ratio", "comparative"
6. metric_name: The financial metric being discussed (e.g., "revenue", "operating margin", "EPS")
7. claimed_value: The numerical value claimed
8. claimed_unit: The unit (USD_millions, USD_billions, percentage, USD_per_share, basis_points)
9. comparison_basis: If a comparison is made, what period or baseline (e.g., "year-over-year", "vs Q3 2023")
10. gaap_type: "gaap", "non_gaap", or "ambiguous" - whether the metric is GAAP or non-GAAP
11. extraction_confidence: 0.0-1.0, how confident you are in the extraction

Rules:
- Only extract claims with specific numbers, not vague statements
- If a speaker says "approximately" or "about", still extract but note lower confidence
- For non-GAAP metrics, look for keywords like "adjusted", "non-GAAP", "excluding"
- If the speaker doesn't specify GAAP vs non-GAAP, mark as "ambiguous"
- Convert all dollar values to millions (e.g., "$1.2 billion" -> claimed_value: 1200, claimed_unit: "USD_millions")
- For percentages, store as the percentage value (e.g., "grew 15%" -> claimed_value: 15, claimed_unit: "percentage")
- For EPS, use USD_per_share as the unit
- For basis points, store the bps value directly`;

export const EXTRACTION_FEW_SHOT = `Here are examples of correctly extracted claims:

Example 1 - Absolute Value:
Transcript: "Total revenue for the quarter was $94.9 billion, up 6% from a year ago."
Extracted:
{
  "exact_quote": "Total revenue for the quarter was $94.9 billion, up 6% from a year ago.",
  "claim_type": "absolute_value",
  "metric_name": "revenue",
  "claimed_value": 94900,
  "claimed_unit": "USD_millions",
  "comparison_basis": null,
  "gaap_type": "ambiguous",
  "extraction_confidence": 0.95
}
AND a second claim from the same quote:
{
  "exact_quote": "Total revenue for the quarter was $94.9 billion, up 6% from a year ago.",
  "claim_type": "growth_rate",
  "metric_name": "revenue",
  "claimed_value": 6,
  "claimed_unit": "percentage",
  "comparison_basis": "year-over-year",
  "gaap_type": "ambiguous",
  "extraction_confidence": 0.95
}

Example 2 - Non-GAAP Metric:
Transcript: "Non-GAAP operating margin was 47%, an improvement of 300 basis points year over year."
Extracted:
{
  "exact_quote": "Non-GAAP operating margin was 47%, an improvement of 300 basis points year over year.",
  "claim_type": "margin_or_ratio",
  "metric_name": "operating margin",
  "claimed_value": 47,
  "claimed_unit": "percentage",
  "comparison_basis": null,
  "gaap_type": "non_gaap",
  "extraction_confidence": 0.95
}

Example 3 - EPS:
Transcript: "Diluted earnings per share were $2.18, compared to $1.46 in the prior year period."
Extracted:
{
  "exact_quote": "Diluted earnings per share were $2.18, compared to $1.46 in the prior year period.",
  "claim_type": "absolute_value",
  "metric_name": "diluted EPS",
  "claimed_value": 2.18,
  "claimed_unit": "USD_per_share",
  "comparison_basis": null,
  "gaap_type": "ambiguous",
  "extraction_confidence": 0.95
}

Example 4 - Growth Rate:
Transcript: "Cloud revenue grew 29% year over year to $33.7 billion."
Extracted:
{
  "exact_quote": "Cloud revenue grew 29% year over year to $33.7 billion.",
  "claim_type": "growth_rate",
  "metric_name": "cloud revenue",
  "claimed_value": 29,
  "claimed_unit": "percentage",
  "comparison_basis": "year-over-year",
  "gaap_type": "ambiguous",
  "extraction_confidence": 0.9
}`;

export const EXTRACTION_OUTPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    claims: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          exact_quote: { type: "string" as const },
          speaker_name: { type: "string" as const },
          speaker_role: { type: "string" as const },
          session: {
            type: "string" as const,
            enum: ["prepared_remarks", "qa"],
          },
          claim_type: {
            type: "string" as const,
            enum: [
              "absolute_value",
              "growth_rate",
              "margin_or_ratio",
              "comparative",
            ],
          },
          metric_name: { type: "string" as const },
          claimed_value: { type: "number" as const },
          claimed_unit: {
            type: "string" as const,
            enum: [
              "USD_millions",
              "USD_billions",
              "percentage",
              "USD_per_share",
              "basis_points",
              "count",
            ],
          },
          comparison_basis: { type: ["string", "null"] as const },
          gaap_type: {
            type: "string" as const,
            enum: ["gaap", "non_gaap", "ambiguous"],
          },
          extraction_confidence: {
            type: "number" as const,
            minimum: 0,
            maximum: 1,
          },
        },
        required: [
          "exact_quote",
          "speaker_name",
          "speaker_role",
          "session",
          "claim_type",
          "metric_name",
          "claimed_value",
          "claimed_unit",
          "gaap_type",
          "extraction_confidence",
        ],
      },
    },
  },
  required: ["claims"],
};
