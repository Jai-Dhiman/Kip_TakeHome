import type { Cache } from "./cache";
import { fiscalQuarterEndDate } from "./fiscal-calendar";
import type {
  FiscalPeriod,
  Transcript,
  TranscriptSection,
} from "~/lib/types";

const API_BASE = "https://v2.api.earningscall.biz";
const MIN_CALL_INTERVAL = 500;
let lastCallTime = 0;

// Exchange lookup for EarningsCall API
const TICKER_EXCHANGE: Record<string, string> = {
  AAPL: "NASDAQ",
  TSLA: "NASDAQ",
  MSFT: "NASDAQ",
  META: "NASDAQ",
  NFLX: "NASDAQ",
  COST: "NASDAQ",
  COIN: "NASDAQ",
  CRM: "NYSE",
  JPM: "NYSE",
  PFE: "NYSE",
};

async function rateLimit(): Promise<void> {
  const elapsed = Date.now() - lastCallTime;
  if (elapsed < MIN_CALL_INTERVAL) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_CALL_INTERVAL - elapsed)
    );
  }
  lastCallTime = Date.now();
}

interface EarningsCallSpeakerEntry {
  speaker: string;
  text: string;
}

interface EarningsCallSpeakerInfo {
  name: string;
  title: string;
}

interface EarningsCallResponse {
  event: {
    year: number;
    quarter: number;
    conference_date: string | null;
  };
  speakers: EarningsCallSpeakerEntry[];
  speaker_name_map_v2: Record<string, EarningsCallSpeakerInfo>;
}

export class FinnhubClient {
  private apiKey: string;

  constructor(
    private cache: Cache,
    apiKey?: string
  ) {
    this.apiKey =
      apiKey ?? process.env.EARNINGSCALL_API_KEY ?? "demo";
  }

  async getTranscript(
    ticker: string,
    fiscalYear: number,
    fiscalQuarter: number
  ): Promise<Transcript | null> {
    const cacheKey = `ecall-${ticker}-FY${fiscalYear}Q${fiscalQuarter}`;
    const cached = this.cache.get("transcripts", cacheKey) as
      | (EarningsCallResponse & { not_found?: boolean })
      | null;
    if (cached !== null) {
      if (cached.not_found) return null;
      return this.parseResponse(cached, ticker, fiscalYear, fiscalQuarter);
    }

    await rateLimit();

    const exchange = TICKER_EXCHANGE[ticker] ?? "NASDAQ";
    const url =
      `${API_BASE}/transcript?exchange=${exchange}&symbol=${ticker}` +
      `&year=${fiscalYear}&quarter=${fiscalQuarter}&level=2&apikey=${this.apiKey}`;

    const response = await fetch(url);

    if (response.status === 403) {
      throw new Error(
        `EarningsCall API denied access for ${ticker} FY${fiscalYear}Q${fiscalQuarter}. ` +
          `The demo key only supports AAPL and MSFT. Set EARNINGSCALL_API_KEY for other tickers.`
      );
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `EarningsCall API error for ${ticker} FY${fiscalYear}Q${fiscalQuarter}: ${response.status} - ${body.slice(0, 200)}`
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      const body = await response.text();
      throw new Error(
        `EarningsCall returned non-JSON (${contentType}) for ${ticker} FY${fiscalYear}Q${fiscalQuarter}: ${body.slice(0, 200)}`
      );
    }

    const result = (await response.json()) as EarningsCallResponse;

    if (!result.speakers || result.speakers.length === 0) {
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
    data: EarningsCallResponse,
    ticker: string,
    fiscalYear: number,
    fiscalQuarter: number
  ): Transcript {
    const sections: TranscriptSection[] = [];
    const rawParts: string[] = [];
    const nameMap = data.speaker_name_map_v2 ?? {};

    // Detect when Q&A starts - typically after an Operator speaks mid-call
    let qaStarted = false;

    for (const entry of data.speakers ?? []) {
      const speakerInfo = nameMap[entry.speaker];
      const name = speakerInfo?.name ?? entry.speaker;
      const title = speakerInfo?.title ?? "";
      const text = entry.text ?? "";

      // Detect Q&A transition
      if (
        !qaStarted &&
        name.toLowerCase() === "operator" &&
        text.toLowerCase().includes("question")
      ) {
        qaStarted = true;
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
      transcript_date: data.event?.conference_date?.split("T")[0] ?? null,
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
