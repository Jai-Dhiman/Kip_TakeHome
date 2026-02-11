import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { $ } from "bun";
import type {
  CredibilityScore,
  Debate,
  ExtractedClaim,
  MisleadingAssessment,
  VerificationResult,
} from "~/lib/types";
import { extractClaims } from "./agents/extraction";
import { VerificationEngine } from "./agents/verification";
import { detectOmissions } from "./agents/omission-detector";
import { runDebate } from "./agents/debate";
import { Cache } from "./data/cache";
import { COMPANIES } from "./data/companies";
import { EdgarClient } from "./data/edgar-client";
import { FinnhubClient } from "./data/finnhub-client";
import { fiscalQuarterEndDate, getRecentQuarters } from "./data/fiscal-calendar";

const RESULTS_DB_PATH = join(import.meta.dir, "..", "results", "execcheck_results.db");
const D1_DATABASE_NAME = "execcheck-db";
const BATCH_SIZE = 50;

function initResultsDb(dbPath: string = RESULTS_DB_PATH): Database {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);

  db.run(`
    CREATE TABLE IF NOT EXISTS companies (
      ticker TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sector TEXT NOT NULL,
      fiscal_year_end_month INTEGER NOT NULL,
      cik TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS quarters (
      id TEXT PRIMARY KEY,
      ticker TEXT NOT NULL REFERENCES companies(ticker),
      fiscal_year INTEGER NOT NULL,
      fiscal_quarter INTEGER NOT NULL,
      period_end_date TEXT NOT NULL,
      transcript_date TEXT,
      UNIQUE(ticker, fiscal_year, fiscal_quarter)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      quarter_id TEXT NOT NULL REFERENCES quarters(id),
      speaker_name TEXT NOT NULL,
      speaker_role TEXT NOT NULL,
      session TEXT NOT NULL,
      exact_quote TEXT NOT NULL,
      claim_type TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      claimed_value REAL NOT NULL,
      claimed_unit TEXT NOT NULL,
      comparison_basis TEXT,
      gaap_type TEXT NOT NULL,
      extraction_confidence REAL NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS verifications (
      claim_id TEXT PRIMARY KEY REFERENCES claims(id),
      status TEXT NOT NULL,
      actual_value REAL,
      deviation_absolute REAL,
      deviation_percentage REAL,
      edgar_concept TEXT,
      data_source TEXT,
      notes TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS misleading_assessments (
      claim_id TEXT PRIMARY KEY REFERENCES claims(id),
      tactics TEXT NOT NULL,
      severity TEXT NOT NULL,
      explanation TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS debates (
      quarter_id TEXT PRIMARY KEY REFERENCES quarters(id),
      bull_argument TEXT NOT NULL,
      bear_argument TEXT NOT NULL,
      judge_verdict TEXT NOT NULL,
      rounds INTEGER NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS credibility_scores (
      quarter_id TEXT PRIMARY KEY REFERENCES quarters(id),
      overall_score REAL NOT NULL,
      accuracy_score REAL NOT NULL,
      framing_score REAL NOT NULL,
      consistency_score REAL NOT NULL,
      transparency_score REAL NOT NULL,
      total_claims INTEGER NOT NULL,
      verified_claims INTEGER NOT NULL,
      inaccurate_claims INTEGER NOT NULL,
      misleading_claims INTEGER NOT NULL,
      unverifiable_claims INTEGER NOT NULL,
      summary TEXT NOT NULL,
      omitted_metrics TEXT
    )
  `);

  return db;
}

function storeResults(
  db: Database,
  ticker: string,
  quarterId: string,
  fiscalYear: number,
  fiscalQuarter: number,
  periodEndDate: string,
  transcriptDate: string | null,
  claims: ExtractedClaim[],
  verifications: VerificationResult[],
  assessments: MisleadingAssessment[],
  debate: Debate,
  score: CredibilityScore
): void {
  db.run(
    `INSERT OR REPLACE INTO quarters (id, ticker, fiscal_year, fiscal_quarter, period_end_date, transcript_date) VALUES (?, ?, ?, ?, ?, ?)`,
    [quarterId, ticker, fiscalYear, fiscalQuarter, periodEndDate, transcriptDate]
  );

  const insertClaim = db.prepare(
    `INSERT OR REPLACE INTO claims (id, quarter_id, speaker_name, speaker_role, session, exact_quote, claim_type, metric_name, claimed_value, claimed_unit, comparison_basis, gaap_type, extraction_confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const c of claims) {
    insertClaim.run(
      c.id, c.quarter_id, c.speaker_name, c.speaker_role, c.session,
      c.exact_quote, c.claim_type, c.metric_name, c.claimed_value,
      c.claimed_unit, c.comparison_basis, c.gaap_type, c.extraction_confidence
    );
  }

  const insertVerification = db.prepare(
    `INSERT OR REPLACE INTO verifications (claim_id, status, actual_value, deviation_absolute, deviation_percentage, edgar_concept, data_source, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const v of verifications) {
    insertVerification.run(
      v.claim_id, v.status, v.actual_value, v.deviation_absolute,
      v.deviation_percentage, v.edgar_concept, v.data_source, v.notes
    );
  }

  const insertAssessment = db.prepare(
    `INSERT OR REPLACE INTO misleading_assessments (claim_id, tactics, severity, explanation) VALUES (?, ?, ?, ?)`
  );
  for (const a of assessments) {
    insertAssessment.run(a.claim_id, a.tactics, a.severity, a.explanation);
  }

  db.run(
    `INSERT OR REPLACE INTO debates (quarter_id, bull_argument, bear_argument, judge_verdict, rounds) VALUES (?, ?, ?, ?, ?)`,
    [debate.quarter_id, debate.bull_argument, debate.bear_argument, debate.judge_verdict, debate.rounds]
  );

  db.run(
    `INSERT OR REPLACE INTO credibility_scores (quarter_id, overall_score, accuracy_score, framing_score, consistency_score, transparency_score, total_claims, verified_claims, inaccurate_claims, misleading_claims, unverifiable_claims, summary, omitted_metrics) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      score.quarter_id, score.overall_score, score.accuracy_score, score.framing_score,
      score.consistency_score, score.transparency_score, score.total_claims,
      score.verified_claims, score.inaccurate_claims, score.misleading_claims,
      score.unverifiable_claims, score.summary, score.omitted_metrics,
    ]
  );
}

async function processQuarter(
  ticker: string,
  fiscalYear: number,
  fiscalQuarter: number,
  cache: Cache,
  resultsDb: Database
): Promise<boolean> {
  const quarterId = `${ticker}-FY${fiscalYear}Q${fiscalQuarter}`;
  console.log(`Processing ${quarterId}...`);

  const edgar = new EdgarClient(cache);
  const finnhub = new FinnhubClient(cache);
  const verifier = new VerificationEngine(edgar);

  // Step 1: Fetch transcript
  console.log("  Fetching transcript...");
  const transcript = await finnhub.getTranscript(ticker, fiscalYear, fiscalQuarter);
  if (transcript === null) {
    console.warn(`  No transcript available for ${quarterId}, skipping.`);
    return false;
  }

  // Step 2: Extract claims
  console.log("  Extracting claims...");
  const claims = await extractClaims(transcript);
  console.log(`  Extracted ${claims.length} claims`);

  if (claims.length === 0) {
    console.warn(`  No claims extracted for ${quarterId}, skipping.`);
    return false;
  }

  // Step 3: Verify claims
  console.log("  Verifying claims...");
  const [verifications, assessments] = await verifier.verifyAllClaims(
    claims, ticker, fiscalYear, fiscalQuarter
  );

  // Step 4: Detect omissions
  console.log("  Detecting omissions...");
  const omitted = await detectOmissions(
    transcript, claims, edgar, ticker, fiscalYear, fiscalQuarter
  );

  // Step 5: Fetch all metrics for debate context
  console.log("  Fetching financial context...");
  const allMetrics = await edgar.getAllMetrics(ticker, fiscalYear, fiscalQuarter);

  // Step 6: Run debate
  console.log("  Running debate round...");
  const [debate, score] = await runDebate(
    ticker, quarterId, claims, verifications, assessments, allMetrics, omitted
  );

  // Step 7: Store results
  console.log("  Storing results...");
  const periodEnd = fiscalQuarterEndDate(ticker, fiscalYear, fiscalQuarter);
  const periodEndStr = `${periodEnd.getFullYear()}-${String(periodEnd.getMonth() + 1).padStart(2, "0")}-${String(periodEnd.getDate()).padStart(2, "0")}`;

  storeResults(
    resultsDb, ticker, quarterId, fiscalYear, fiscalQuarter,
    periodEndStr, transcript.fiscal_period.transcript_date,
    claims, verifications, assessments, debate, score
  );

  console.log(
    `  Done: ${quarterId} | Score: ${Math.round(score.overall_score)} | ` +
    `Claims: ${score.total_claims} (${score.verified_claims}V/${score.inaccurate_claims}I/${score.misleading_claims}M)`
  );
  return true;
}

// --- D1 Seeding ---

function escapeSqlValue(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  const s = String(val).replace(/'/g, "''");
  return `'${s}'`;
}

function generateInsert(table: string, row: Record<string, unknown>): string {
  const columns = Object.keys(row).join(", ");
  const values = Object.values(row).map(escapeSqlValue).join(", ");
  return `INSERT OR REPLACE INTO ${table} (${columns}) VALUES (${values});`;
}

async function seedD1(dbPath: string = RESULTS_DB_PATH): Promise<void> {
  const db = new Database(dbPath, { readonly: true });

  const tables = [
    "companies",
    "quarters",
    "claims",
    "verifications",
    "misleading_assessments",
    "debates",
    "credibility_scores",
  ];

  for (const table of tables) {
    const rows = db.query(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
    if (rows.length === 0) {
      console.log(`  ${table}: 0 rows, skipping`);
      continue;
    }

    console.log(`  Seeding ${table}: ${rows.length} rows...`);

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const sql = batch.map((row) => generateInsert(table, row)).join("\n");
      try {
        await $`bunx wrangler d1 execute ${D1_DATABASE_NAME} --command ${sql}`.quiet();
      } catch (e) {
        console.error(`  Failed to seed batch ${Math.floor(i / BATCH_SIZE) + 1} for ${table}: ${e}`);
      }
    }
  }

  db.close();
  console.log("D1 seeding complete.");
}

// --- Main entry point ---

async function runPipeline(
  tickers?: string[],
  numQuarters: number = 4
): Promise<void> {
  const targetTickers = tickers ?? COMPANIES.map((c) => c.ticker);

  const cache = new Cache();
  const resultsDb = initResultsDb();

  // Insert company profiles
  const insertCompany = resultsDb.prepare(
    `INSERT OR REPLACE INTO companies (ticker, name, sector, fiscal_year_end_month, cik) VALUES (?, ?, ?, ?, ?)`
  );
  for (const company of COMPANIES) {
    if (targetTickers.includes(company.ticker)) {
      insertCompany.run(
        company.ticker, company.name, company.sector,
        company.fiscal_year_end_month, company.cik
      );
    }
  }

  let total = 0;
  let success = 0;

  for (const ticker of targetTickers) {
    const quarters = getRecentQuarters(ticker, numQuarters);
    console.log(`Processing ${ticker}: ${quarters.length} quarters`);

    for (const q of quarters) {
      total += 1;
      try {
        if (await processQuarter(ticker, q.fiscal_year, q.fiscal_quarter, cache, resultsDb)) {
          success += 1;
        }
      } catch (e) {
        console.error(`Failed to process ${ticker} FY${q.fiscal_year}Q${q.fiscal_quarter}: ${e}`);
      }
    }
  }

  console.log(`Pipeline complete: ${success}/${total} quarters processed successfully`);
  resultsDb.close();
  cache.close();
}

// --- CLI ---

const args = process.argv.slice(2);

if (args.includes("--seed")) {
  console.log("Seeding D1...");
  await seedD1();
} else if (args.includes("--export-sql")) {
  const db = new Database(RESULTS_DB_PATH, { readonly: true });
  const tables = [
    "companies", "quarters", "claims", "verifications",
    "misleading_assessments", "debates", "credibility_scores",
  ];
  for (const table of tables) {
    const rows = db.query(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
    for (const row of rows) {
      console.log(generateInsert(table, row));
    }
  }
  db.close();
} else {
  const tickers = args.filter((a) => !a.startsWith("--"));
  await runPipeline(tickers.length > 0 ? tickers : undefined);
}
