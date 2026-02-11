-- Kip Takehome D1 Schema
CREATE TABLE IF NOT EXISTS companies (
  ticker TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sector TEXT NOT NULL,
  fiscal_year_end_month INTEGER NOT NULL,
  cik TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quarters (
  id TEXT PRIMARY KEY,
  ticker TEXT NOT NULL REFERENCES companies(ticker),
  fiscal_year INTEGER NOT NULL,
  fiscal_quarter INTEGER NOT NULL,
  period_end_date TEXT NOT NULL,
  transcript_date TEXT,
  UNIQUE(ticker, fiscal_year, fiscal_quarter)
);

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
);

CREATE TABLE IF NOT EXISTS verifications (
  claim_id TEXT PRIMARY KEY REFERENCES claims(id),
  status TEXT NOT NULL,
  actual_value REAL,
  deviation_absolute REAL,
  deviation_percentage REAL,
  edgar_concept TEXT,
  data_source TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS misleading_assessments (
  claim_id TEXT PRIMARY KEY REFERENCES claims(id),
  tactics TEXT NOT NULL,
  severity TEXT NOT NULL,
  explanation TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS debates (
  quarter_id TEXT PRIMARY KEY REFERENCES quarters(id),
  bull_argument TEXT NOT NULL,
  bear_argument TEXT NOT NULL,
  judge_verdict TEXT NOT NULL,
  rounds INTEGER NOT NULL
);

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
);
