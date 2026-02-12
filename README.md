# Kip Take Home

Earnings call credibility analysis for 10 public companies (AAPL, TSLA, MSFT, META, JPM, COST, CRM, PFE, NFLX, COIN). Extracts quantitative claims from transcripts, verifies them against SEC filings, and scores management credibility through an adversarial debate system.

**Live demo:** https://kiptakehome.jai-d.workers.dev/

## Data Sources

- **Transcripts:** AlphaVantage Earnings Call Transcripts API: last 4 quarters per company
- **Financial data:** SEC EDGAR XBRL API: quarterly and annual filings (10-Q, 10-K), 60+ mapped metrics
- **Q4 handling:** Q4 values are decomposed from annual totals (Annual - Q1 - Q2 - Q3) since 10-K filings often lack standalone Q4 data

## Key Decisions

**Agentic pipeline over monolithic prompting.** The pipeline runs as discrete stages: extraction, verification, omission detection, debate, each with a focused prompt and structured output schema. This makes each stage independently testable and debuggable versus one giant prompt.

**Adversarial debate for scoring.** A single LLM scoring credibility tends toward either leniency or harshness depending on the prompt. Instead, a Bull agent defends management, a Bear agent prosecutes, and a Judge produces a four-dimensional score (accuracy, framing, consistency, transparency). Built with LangGraph for the state machine orchestration.

**Hybrid LLM strategy.** Claude handles extraction and judging where structured output reliability matters. Llama 3.3 70B on Workers AI handles the debate rounds where the task is argumentative text generation and cost matters more than schema adherence.

**Omission detection as a first-class feature.** The most common form of misleading is not mentioning bad numbers. The pipeline compares YoY financial changes against what was discussed and flags significant negative changes that management avoided.

**Tolerance-based verification.** Claims are verified with defined tolerance bands (0.5% for absolute values, 0.3pp for growth rates and margins). "Misleading" is a specific classification: the system defines eight tactics including rounding inflation, GAAP/non-GAAP manipulation, cherry-picking, and base period manipulation.

## What I'd Improve With More Time

- **Segment-level verification:** Currently only company-level metrics are verifiable against SEC filings. Segment data (e.g., "iPhone revenue grew 12%") exists in filings but requires more complex XBRL parsing
- **Real-time pipeline:** Trigger processing automatically when new earnings calls are filed, rather than batch runs
- **Historical trend analysis:** Cross-quarter pattern detection for repeated misleading tactics by the same executives
- **Expanded claim types:** Forward-looking guidance tracking (did they hit what they promised last quarter?)   
- **Source linking:** Deep links from each claim directly to the SEC filing paragraph containing the actual number

## Stack

React 19, TanStack Router/Query/Table, Tailwind CSS 4, Vite, Cloudflare Workers + D1, Anthropic Claude, Cloudflare Workers AI, LangGraph

## Running Locally

```
bun install
bun run dev
```

Pipeline (requires ANTHROPIC_API_KEY and ALPHA_VANTAGE_API_KEY):
```
bun run pipeline
```
