import { describe, expect, mock, test } from "bun:test";
import { VerificationEngine } from "../pipeline/agents/verification";
import type { ExtractedClaim, VerificationStatus } from "../src/lib/types";

function makeClaim(overrides: Partial<ExtractedClaim> = {}): ExtractedClaim {
  return {
    id: "test-claim-1",
    quarter_id: "AAPL-FY2024Q4",
    speaker_name: "Tim Cook",
    speaker_role: "CEO",
    session: "prepared_remarks",
    exact_quote: "Revenue was $94.9 billion",
    claim_type: "absolute_value",
    metric_name: "revenue",
    claimed_value: 94900,
    claimed_unit: "USD_millions",
    comparison_basis: null,
    gaap_type: "ambiguous",
    extraction_confidence: 0.95,
    ...overrides,
  };
}

function makeEngine(metricValue: number | null): VerificationEngine {
  const mockEdgar = {
    getFinancialValue: mock(() => Promise.resolve(metricValue)),
    getAllMetrics: mock(() => Promise.resolve({})),
  };
  return new VerificationEngine(mockEdgar as never);
}

describe("absolute value verification", () => {
  test("verified exact match", async () => {
    const engine = makeEngine(94_900_000_000);
    const claim = makeClaim({ claimed_value: 94900 });
    const [result, assessment] = await engine.verifyClaim(claim, 2024, 4, "AAPL");
    expect(result.status).toBe("verified" as VerificationStatus);
    expect(assessment).toBeNull();
  });

  test("verified within tolerance", async () => {
    // 0.3% deviation -> within 0.5% tolerance
    const engine = makeEngine(95_200_000_000);
    const claim = makeClaim({ claimed_value: 94900 });
    const [result] = await engine.verifyClaim(claim, 2024, 4, "AAPL");
    expect(result.status).toBe("verified" as VerificationStatus);
  });

  test("inaccurate beyond tolerance", async () => {
    // ~10% deviation
    const engine = makeEngine(86_000_000_000);
    const claim = makeClaim({ claimed_value: 94900 });
    const [result, assessment] = await engine.verifyClaim(claim, 2024, 4, "AAPL");
    expect(result.status).toBe("inaccurate" as VerificationStatus);
    expect(assessment).not.toBeNull();
  });

  test("unverifiable no data", async () => {
    const engine = makeEngine(null);
    const claim = makeClaim();
    const [result] = await engine.verifyClaim(claim, 2024, 4, "AAPL");
    expect(result.status).toBe("unverifiable" as VerificationStatus);
  });

  test("unverifiable unknown metric", async () => {
    const engine = makeEngine(100);
    const claim = makeClaim({ metric_name: "quantum_synergy_ratio" });
    const [result] = await engine.verifyClaim(claim, 2024, 4, "AAPL");
    expect(result.status).toBe("unverifiable" as VerificationStatus);
  });
});

describe("margin verification", () => {
  test("margin verified", async () => {
    const engine = makeEngine(46.8);
    const claim = makeClaim({
      metric_name: "gross margin",
      claimed_value: 46.8,
      claimed_unit: "percentage",
      claim_type: "margin_or_ratio",
    });
    const [result] = await engine.verifyClaim(claim, 2024, 4, "AAPL");
    expect(result.status).toBe("verified" as VerificationStatus);
  });

  test("margin inaccurate", async () => {
    const engine = makeEngine(42.0);
    const claim = makeClaim({
      metric_name: "gross margin",
      claimed_value: 47.0,
      claimed_unit: "percentage",
      claim_type: "margin_or_ratio",
    });
    const [result, assessment] = await engine.verifyClaim(claim, 2024, 4, "AAPL");
    expect(result.status).toBe("inaccurate" as VerificationStatus);
    expect(assessment).not.toBeNull();
  });
});

describe("growth rate verification", () => {
  test("growth rate verified", async () => {
    // Current: $100B, prior: $90B -> 11.1% growth
    const mockEdgar = {
      getFinancialValue: mock()
        .mockResolvedValueOnce(100_000_000_000)
        .mockResolvedValueOnce(90_000_000_000),
      getAllMetrics: mock(() => Promise.resolve({})),
    };
    const engine = new VerificationEngine(mockEdgar as never);

    const claim = makeClaim({
      metric_name: "revenue",
      claimed_value: 11.1,
      claimed_unit: "percentage",
      claim_type: "growth_rate",
      comparison_basis: "year-over-year",
    });
    const [result] = await engine.verifyClaim(claim, 2024, 4, "AAPL");
    expect(result.status).toBe("verified" as VerificationStatus);
  });

  test("growth rate inaccurate", async () => {
    // Current: $100B, prior: $95B -> ~5.3% growth, claims 10%
    const mockEdgar = {
      getFinancialValue: mock()
        .mockResolvedValueOnce(100_000_000_000)
        .mockResolvedValueOnce(95_000_000_000),
      getAllMetrics: mock(() => Promise.resolve({})),
    };
    const engine = new VerificationEngine(mockEdgar as never);

    const claim = makeClaim({
      metric_name: "revenue",
      claimed_value: 10.0,
      claimed_unit: "percentage",
      claim_type: "growth_rate",
      comparison_basis: "year-over-year",
    });
    const [result, assessment] = await engine.verifyClaim(claim, 2024, 4, "AAPL");
    expect(result.status).toBe("inaccurate" as VerificationStatus);
    expect(assessment).not.toBeNull();
  });
});

describe("verify all claims", () => {
  test("batch verification", async () => {
    const engine = makeEngine(94_900_000_000);
    const claims = [
      makeClaim({ id: "claim-1", claimed_value: 94900 }),
      makeClaim({ id: "claim-2", claimed_value: 94900 }),
    ];
    const [verifications] = await engine.verifyAllClaims(claims, "AAPL", 2024, 4);
    expect(verifications.length).toBe(2);
  });
});
