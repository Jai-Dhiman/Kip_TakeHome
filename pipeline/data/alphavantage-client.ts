import type { Cache } from "./cache";
import { fiscalQuarterEndDate } from "./fiscal-calendar";
import type {
  FiscalPeriod,
  Transcript,
  TranscriptSection,
} from "~/lib/types";

const API_BASE = "https://www.alphavantage.co/query";
const MIN_CALL_INTERVAL = 1500; // Alpha Vantage free tier is rate-limited
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

interface AlphaVantageTranscriptEntry {
  speaker: string;
  title: string;
  content: string;
  sentiment: string;
}

interface AlphaVantageResponse {
  symbol: string;
  quarter: string;
  transcript: AlphaVantageTranscriptEntry[];
  Information?: string;
  "Error Message"?: string;
}

export class AlphaVantageClient {
  private apiKey: string;

  constructor(
    private cache: Cache,
    apiKey?: string
  ) {
    this.apiKey =
      apiKey ?? process.env.ALPHA_VANTAGE_API_KEY ?? "";
    if (!this.apiKey) {
      throw new Error(
        "ALPHA_VANTAGE_API_KEY is required. Get a free key at https://www.alphavantage.co/support/#api-key"
      );
    }
  }

  async getTranscript(
    ticker: string,
    fiscalYear: number,
    fiscalQuarter: number
  ): Promise<Transcript | null> {
    const cacheKey = `av-${ticker}-FY${fiscalYear}Q${fiscalQuarter}`;
    const cached = this.cache.get("transcripts", cacheKey) as
      | (AlphaVantageResponse & { not_found?: boolean })
      | null;
    if (cached !== null) {
      if (cached.not_found) return null;
      return this.parseResponse(cached, ticker, fiscalYear, fiscalQuarter);
    }

    await rateLimit();

    const calendarQuarter = this.fiscalToCalendarQuarter(ticker, fiscalYear, fiscalQuarter);
    const url =
      `${API_BASE}?function=EARNINGS_CALL_TRANSCRIPT` +
      `&symbol=${ticker}` +
      `&quarter=${calendarQuarter}` +
      `&apikey=${this.apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Alpha Vantage API error for ${ticker} FY${fiscalYear}Q${fiscalQuarter}: ${response.status}`
      );
    }

    const result = (await response.json()) as AlphaVantageResponse;

    if (result.Information) {
      throw new Error(
        `Alpha Vantage rate limit or key issue for ${ticker} FY${fiscalYear}Q${fiscalQuarter}: ${result.Information}`
      );
    }

    if (result["Error Message"]) {
      throw new Error(
        `Alpha Vantage error for ${ticker} FY${fiscalYear}Q${fiscalQuarter}: ${result["Error Message"]}`
      );
    }

    if (!result.transcript || result.transcript.length === 0) {
      console.log(
        `No transcript found for ${ticker} FY${fiscalYear}Q${fiscalQuarter} (AV: ${calendarQuarter})`
      );
      this.cache.set("transcripts", cacheKey, { not_found: true } as never);
      return null;
    }

    this.cache.set("transcripts", cacheKey, result);
    return this.parseResponse(result, ticker, fiscalYear, fiscalQuarter);
  }

  private fiscalToCalendarQuarter(
    ticker: string,
    fiscalYear: number,
    fiscalQuarter: number
  ): string {
    const endDate = fiscalQuarterEndDate(ticker, fiscalYear, fiscalQuarter);
    const calendarYear = endDate.getFullYear();
    const month = endDate.getMonth() + 1; // 1-indexed
    const calendarQ = Math.ceil(month / 3);
    return `${calendarYear}Q${calendarQ}`;
  }

  private parseResponse(
    data: AlphaVantageResponse,
    ticker: string,
    fiscalYear: number,
    fiscalQuarter: number
  ): Transcript {
    const sections: TranscriptSection[] = [];
    const rawParts: string[] = [];

    let qaStarted = false;

    for (const entry of data.transcript ?? []) {
      const name = entry.speaker ?? "Unknown";
      const title = entry.title ?? "";
      const text = entry.content ?? "";
      const textLower = text.toLowerCase();
      const nameLower = name.toLowerCase();

      // Detect Q&A transition
      if (!qaStarted) {
        const isOperator = nameLower === "operator";
        const isIR = title.toLowerCase().includes("investor relations");

        if (isOperator && textLower.includes("question")) {
          qaStarted = true;
        } else if (
          isIR &&
          (textLower.includes("go to investor questions") ||
            textLower.includes("go to analyst questions") ||
            textLower.includes("open the line") ||
            textLower.includes("open it up for questions") ||
            textLower.includes("first question"))
        ) {
          qaStarted = true;
        }
      }

      const session = qaStarted ? "qa" : "prepared_remarks";
      const role = this.inferRole(name, title, session);

      sections.push({
        speaker_name: name,
        speaker_role: role,
        session,
        text,
      });
      rawParts.push(`[${name} - ${role}]\n${text}`);
    }

    const periodEnd = fiscalQuarterEndDate(ticker, fiscalYear, fiscalQuarter);

    const fiscalPeriod: FiscalPeriod = {
      ticker,
      fiscal_year: fiscalYear,
      fiscal_quarter: fiscalQuarter,
      period_end_date: this.formatDate(periodEnd),
      transcript_date: null, // Alpha Vantage doesn't provide conference date
    };

    return {
      ticker,
      fiscal_period: fiscalPeriod,
      sections,
      raw_text: rawParts.join("\n\n"),
    };
  }

  private inferRole(name: string, title: string, session: string): string {
    const combined = `${name} ${title}`.toLowerCase();
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
      ["investor relations", "IR"],
    ];

    for (const [keyword, role] of roleKeywords) {
      if (combined.includes(keyword)) return role;
    }

    if (session === "qa") return "Analyst";
    return "Executive";
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}
