import { Cache } from "./data/cache";
import { AlphaVantageClient } from "./data/alphavantage-client";
import { getRecentQuarters } from "./data/fiscal-calendar";
import { COMPANIES } from "./data/companies";

const API_KEYS = process.argv.slice(2);
if (API_KEYS.length === 0) {
  console.error("Usage: bun run pipeline/prefetch-transcripts.ts <key1> [key2] [key3...]");
  process.exit(1);
}

const cache = new Cache();

// Figure out what's already cached
const allFetches: { ticker: string; fy: number; fq: number }[] = [];
const alreadyCached: string[] = [];

for (const company of COMPANIES) {
  const quarters = getRecentQuarters(company.ticker, 4);
  for (const q of quarters) {
    const cacheKey = `av-${company.ticker}-FY${q.fiscal_year}Q${q.fiscal_quarter}`;
    if (cache.has("transcripts", cacheKey)) {
      alreadyCached.push(cacheKey);
    } else {
      allFetches.push({ ticker: company.ticker, fy: q.fiscal_year, fq: q.fiscal_quarter });
    }
  }
}

console.log(`Already cached: ${alreadyCached.length}`);
for (const k of alreadyCached) console.log(`  ${k}`);
console.log(`\nNeed to fetch: ${allFetches.length}`);
console.log(`API keys available: ${API_KEYS.length} (${API_KEYS.length * 25} total requests)\n`);

if (allFetches.length > API_KEYS.length * 25) {
  console.error(`Not enough API quota: need ${allFetches.length}, have ${API_KEYS.length * 25}`);
  process.exit(1);
}

let keyIndex = 0;
let usedOnCurrentKey = 0;
let success = 0;
let failed = 0;

for (const { ticker, fy, fq } of allFetches) {
  // Rotate key when approaching limit
  if (usedOnCurrentKey >= 24 && keyIndex < API_KEYS.length - 1) {
    keyIndex++;
    usedOnCurrentKey = 0;
    console.log(`\n--- Switching to API key ${keyIndex + 1} ---\n`);
  }

  const client = new AlphaVantageClient(cache, API_KEYS[keyIndex]);
  const label = `${ticker} FY${fy}Q${fq}`;

  try {
    const transcript = await client.getTranscript(ticker, fy, fq);
    usedOnCurrentKey++;
    if (transcript) {
      console.log(`  [${success + failed + 1}/${allFetches.length}] ${label}: ${transcript.sections.length} sections cached`);
      success++;
    } else {
      console.log(`  [${success + failed + 1}/${allFetches.length}] ${label}: no transcript available`);
      failed++;
    }
  } catch (e) {
    console.error(`  [${success + failed + 1}/${allFetches.length}] ${label}: FAILED - ${e}`);
    failed++;
    // If rate limited, try switching keys
    if (String(e).includes("rate limit") && keyIndex < API_KEYS.length - 1) {
      keyIndex++;
      usedOnCurrentKey = 0;
      console.log(`\n--- Rate limited, switching to API key ${keyIndex + 1} ---\n`);
    }
  }
}

cache.close();
console.log(`\nPrefetch complete: ${success} cached, ${failed} failed, ${alreadyCached.length} already cached`);
console.log(`Total transcripts in cache: ${success + alreadyCached.length}`);
