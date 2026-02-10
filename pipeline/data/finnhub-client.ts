import type { Cache } from "./cache";
import { fiscalQuarterEndDate } from "./fiscal-calendar";
import type {
  FiscalPeriod,
  Transcript,
  TranscriptSection,
} from "~/lib/types";

const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";
const MIN_CALL_INTERVAL = 1100; // 1.1 seconds in ms
let lastCallTime = 0;

async function rateLimit(): Promise<void> {
  const elapsed = Date.now() - lastCallTime;
  if (elapsed < MIN_CALL_INTERVAL) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_CALL_INTERVAL - elapsed)
    );
  }
  lastCallTime = Date.now();
}

interface FinnhubTranscriptEntry {
  name: string;
  speech: string;
  section: string;
}

interface FinnhubTranscriptResponse {
  transcript: FinnhubTranscriptEntry[];
  time?: string;
}

export class FinnhubClient {
  private apiKey: string;

  constructor(
    private cache: Cache,
    apiKey?: string
  ) {
    this.apiKey = apiKey ?? process.env.FINNHUB_API_KEY ?? "";
    if (!this.apiKey) {
      throw new Error("FINNHUB_API_KEY environment variable is required");
    }
  }

  async getTranscript(
    ticker: string,
    fiscalYear: number,
    fiscalQuarter: number
  ): Promise<Transcript | null> {
    const cacheKey = `${ticker}-FY${fiscalYear}Q${fiscalQuarter}`;
    const cached = this.cache.get("transcripts", cacheKey) as
      | (FinnhubTranscriptResponse & { not_found?: boolean })
      | null;
    if (cached !== null) {
      if (cached.not_found) return null;
      return this.parseResponse(cached, ticker, fiscalYear, fiscalQuarter);
    }

    await rateLimit();

    const url = `${FINNHUB_BASE_URL}/stock/transcript?symbol=${ticker}&year=${fiscalYear}&quarter=${fiscalQuarter}`;

    const response = await fetch(url, {
      headers: { "X-Finnhub-Token": this.apiKey },
    });

    if (!response.ok) {
      throw new Error(
        `Finnhub API error for ${ticker} FY${fiscalYear}Q${fiscalQuarter}: ${response.status}`
      );
    }

    const result = (await response.json()) as FinnhubTranscriptResponse;

    if (!result.transcript || result.transcript.length === 0) {
      console.log(
        `No transcript found for ${ticker} FY${fiscalYear}Q${fiscalQuarter}`
      );
      this.cache.set("transcripts", cacheKey, { not_found: true } as never);
      return null;
    }

    this.cache.set("transcripts", cacheKey, result);
    return this.parseResponse(result, ticker, fiscalYear, fiscalQuarter);
  }

  private parseResponse(
    data: FinnhubTranscriptResponse,
    ticker: string,
    fiscalYear: number,
    fiscalQuarter: number
  ): Transcript {
    const sections: TranscriptSection[] = [];
    const rawParts: string[] = [];

    for (const entry of data.transcript ?? []) {
      const name = entry.name ?? "Unknown";
      const speech = entry.speech ?? "";
      const section = entry.section ?? "";

      const session =
        section.toLowerCase().includes("question") ||
        section.toLowerCase().includes("q&a")
          ? "qa"
          : "prepared_remarks";

      const role = this.inferRole(name, section);

      sections.push({
        speaker_name: name,
        speaker_role: role,
        session,
        text: speech,
      });
      rawParts.push(`[${name} - ${role}]\n${speech}`);
    }

    const periodEnd = fiscalQuarterEndDate(ticker, fiscalYear, fiscalQuarter);

    const fiscalPeriod: FiscalPeriod = {
      ticker,
      fiscal_year: fiscalYear,
      fiscal_quarter: fiscalQuarter,
      period_end_date: this.formatDate(periodEnd),
      transcript_date: data.time ?? null,
    };

    return {
      ticker,
      fiscal_period: fiscalPeriod,
      sections,
      raw_text: rawParts.join("\n\n"),
    };
  }

  private inferRole(name: string, section: string): string {
    const nameLower = name.toLowerCase();
    const roleKeywords: [string, string][] = [
      ["ceo", "CEO"],
      ["chief executive", "CEO"],
      ["cfo", "CFO"],
      ["chief financial", "CFO"],
      ["coo", "COO"],
      ["chief operating", "COO"],
      ["cto", "CTO"],
      ["president", "President"],
      ["vp", "VP"],
      ["vice president", "VP"],
      ["director", "Director"],
      ["analyst", "Analyst"],
      ["operator", "Operator"],
    ];

    for (const [keyword, role] of roleKeywords) {
      if (nameLower.includes(keyword)) return role;
    }

    if (
      section.toLowerCase().includes("question") ||
      section.toLowerCase().includes("q&a")
    ) {
      return "Analyst";
    }

    return "Executive";
  }

  async listAvailableTranscripts(
    ticker: string
  ): Promise<Record<string, unknown>[]> {
    const cacheKey = `${ticker}-list`;
    const cached = this.cache.get("transcript_list", cacheKey) as
      | Record<string, unknown>[]
      | null;
    if (cached !== null) return cached;

    await rateLimit();

    const url = `${FINNHUB_BASE_URL}/stock/transcript/list?symbol=${ticker}`;
    const response = await fetch(url, {
      headers: { "X-Finnhub-Token": this.apiKey },
    });

    if (!response.ok) {
      throw new Error(`Failed to list transcripts for ${ticker}: ${response.status}`);
    }

    const result = (await response.json()) as {
      transcripts: Record<string, unknown>[];
    };
    const transcripts = result.transcripts ?? [];
    this.cache.set("transcript_list", cacheKey, transcripts);
    return transcripts;
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}
