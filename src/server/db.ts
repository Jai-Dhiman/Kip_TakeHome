import { createServerFn } from "@tanstack/react-start";
import type {
  Claim,
  ClaimWithVerification,
  Company,
  CompanyWithScore,
  CredibilityScore,
  Debate,
  MisleadingAssessment,
  Quarter,
  QuarterSummary,
  Verification,
} from "~/lib/types";

// Helper to get D1 binding from Cloudflare context
// In development, we use a local SQLite fallback
function getDB(): D1Database {
  // @ts-expect-error - Cloudflare Workers global
  const env = globalThis.__env || globalThis.process?.env;
  if (env?.DB) return env.DB;
  throw new Error("D1 database binding not available");
}

export const getCompanies = createServerFn({ method: "GET" }).handler(
  async (): Promise<CompanyWithScore[]> => {
    const db = getDB();

    const companies = await db
      .prepare("SELECT * FROM companies ORDER BY ticker")
      .all<Company>();

    const results: CompanyWithScore[] = [];

    for (const company of companies.results) {
      // Get quarters with scores
      const quarters = await db
        .prepare(
          `SELECT q.id, q.fiscal_year, q.fiscal_quarter, q.period_end_date,
                  cs.overall_score, cs.total_claims
           FROM quarters q
           LEFT JOIN credibility_scores cs ON cs.quarter_id = q.id
           WHERE q.ticker = ?
           ORDER BY q.period_end_date DESC
           LIMIT 4`
        )
        .bind(company.ticker)
        .all<QuarterSummary>();

      // Latest score
      const latestQ = quarters.results[0];
      let latestScore: CredibilityScore | null = null;
      if (latestQ?.overall_score !== null && latestQ?.overall_score !== undefined) {
        const scoreRow = await db
          .prepare("SELECT * FROM credibility_scores WHERE quarter_id = ?")
          .bind(latestQ.id)
          .first<CredibilityScore>();
        latestScore = scoreRow;
      }

      results.push({
        ...company,
        latest_score: latestScore,
        quarters: quarters.results,
      });
    }

    return results;
  }
);

export const getCompany = createServerFn({ method: "GET" })
  .inputValidator((ticker: string) => ticker)
  .handler(async ({ data: ticker }): Promise<CompanyWithScore | null> => {
    const db = getDB();

    const company = await db
      .prepare("SELECT * FROM companies WHERE ticker = ?")
      .bind(ticker.toUpperCase())
      .first<Company>();

    if (!company) return null;

    const quarters = await db
      .prepare(
        `SELECT q.id, q.fiscal_year, q.fiscal_quarter, q.period_end_date,
                cs.overall_score, cs.total_claims
         FROM quarters q
         LEFT JOIN credibility_scores cs ON cs.quarter_id = q.id
         WHERE q.ticker = ?
         ORDER BY q.period_end_date DESC`
      )
      .bind(ticker.toUpperCase())
      .all<QuarterSummary>();

    const latestQ = quarters.results[0];
    let latestScore: CredibilityScore | null = null;
    if (latestQ?.overall_score !== null && latestQ?.overall_score !== undefined) {
      const scoreRow = await db
        .prepare("SELECT * FROM credibility_scores WHERE quarter_id = ?")
        .bind(latestQ.id)
        .first<CredibilityScore>();
      latestScore = scoreRow;
    }

    return {
      ...company,
      latest_score: latestScore,
      quarters: quarters.results,
    };
  });

export const getQuarterDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { ticker: string; year: number; quarter: number }) => input)
  .handler(
    async ({
      data: { ticker, year, quarter },
    }): Promise<{
      quarter: Quarter;
      score: CredibilityScore | null;
      debate: Debate | null;
      claims: ClaimWithVerification[];
    } | null> => {
      const db = getDB();

      const q = await db
        .prepare(
          "SELECT * FROM quarters WHERE ticker = ? AND fiscal_year = ? AND fiscal_quarter = ?"
        )
        .bind(ticker.toUpperCase(), year, quarter)
        .first<Quarter>();

      if (!q) return null;

      const [score, debate, claimsResult] = await Promise.all([
        db
          .prepare("SELECT * FROM credibility_scores WHERE quarter_id = ?")
          .bind(q.id)
          .first<CredibilityScore>(),
        db
          .prepare("SELECT * FROM debates WHERE quarter_id = ?")
          .bind(q.id)
          .first<Debate>(),
        db
          .prepare("SELECT * FROM claims WHERE quarter_id = ? ORDER BY rowid")
          .bind(q.id)
          .all<Claim>(),
      ]);

      // Enrich claims with verifications and misleading assessments
      const claims: ClaimWithVerification[] = [];
      for (const claim of claimsResult.results) {
        const [verification, misleading] = await Promise.all([
          db
            .prepare("SELECT * FROM verifications WHERE claim_id = ?")
            .bind(claim.id)
            .first<Verification>(),
          db
            .prepare("SELECT * FROM misleading_assessments WHERE claim_id = ?")
            .bind(claim.id)
            .first<MisleadingAssessment>(),
        ]);
        claims.push({ ...claim, verification, misleading });
      }

      return { quarter: q, score, debate, claims };
    }
  );
