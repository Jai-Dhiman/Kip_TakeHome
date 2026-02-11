import type { LLMClient, LLMMessage } from "./llm-client";

const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export class WorkersAIClient implements LLMClient {
  private accountId: string;
  private apiToken: string;
  private model: string;

  constructor(model: string = DEFAULT_MODEL) {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId) {
      throw new Error("CLOUDFLARE_ACCOUNT_ID environment variable is required");
    }
    if (!apiToken) {
      throw new Error("CLOUDFLARE_API_TOKEN environment variable is required");
    }

    this.accountId = accountId;
    this.apiToken = apiToken;
    this.model = model;
  }

  async chat(messages: LLMMessage[], maxTokens: number = 4096): Promise<string> {
    return this.callAPI(messages, maxTokens);
  }

  async chatJSON<T>(messages: LLMMessage[], maxTokens: number = 4096): Promise<T> {
    const text = await this.callAPI(messages, maxTokens, { type: "json_object" });

    // Try direct parse first
    try {
      return JSON.parse(text) as T;
    } catch {
      // Fall through to repair
    }

    // Attempt to repair common LLM JSON issues
    const repaired = repairJSON(text);
    try {
      return JSON.parse(repaired) as T;
    } catch (e) {
      // Log a sample of the raw output for debugging
      console.error(
        `[WorkersAI] JSON parse failed after repair. First 500 chars:\n${text.slice(0, 500)}\nLast 200 chars:\n${text.slice(-200)}`
      );
      throw e;
    }
  }

  private isResponsesAPIModel(): boolean {
    return this.model.startsWith("@cf/openai/");
  }

  private async callAPI(
    messages: LLMMessage[],
    maxTokens: number,
    responseFormat?: { type: string },
  ): Promise<string> {
    if (this.isResponsesAPIModel()) {
      return this.callResponsesAPI(messages, maxTokens, responseFormat);
    }
    return this.callNativeStreamingAPI(messages, maxTokens, responseFormat);
  }

  // OpenAI Responses API format for @cf/openai/* models
  private async callResponsesAPI(
    messages: LLMMessage[],
    maxTokens: number,
    responseFormat?: { type: string },
  ): Promise<string> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/v1/responses`;

    // Responses API uses "input" (array of {role, content}) and "instructions" for system
    const systemMsg = messages.find((m) => m.role === "system");
    const nonSystemMsgs = messages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      model: this.model,
      input: nonSystemMsgs.map((m) => ({ role: m.role, content: m.content })),
      max_output_tokens: maxTokens,
    };

    if (systemMsg) {
      body.instructions = systemMsg.content;
    }

    // Note: text.format (json_object) is not supported by Cloudflare's Responses API
    // for this model — JSON output is enforced via prompt instructions instead.

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Workers AI Responses API request failed (${res.status}): ${errText}`);
    }

    // Non-streaming JSON response
    // Response: { output: [{ type: "message", content: [{ type: "output_text", text: "..." }] }] }
    const rawText = await res.text();
    try {
      const data = JSON.parse(rawText);
      // Unwrap Cloudflare envelope if present
      const root = data.result ?? data;
      const output = root.output ?? [];
      const texts: string[] = [];
      for (const item of output) {
        if (item.type === "message" && Array.isArray(item.content)) {
          for (const block of item.content) {
            if (block.type === "output_text" && block.text) {
              texts.push(block.text);
            }
          }
        }
      }
      return texts.join("");
    } catch {
      throw new Error(
        `Workers AI Responses API: unexpected response format. First 500 chars:\n${rawText.slice(0, 500)}`
      );
    }
  }

  // Native Cloudflare Workers AI streaming format for @cf/meta/* models
  private async callNativeStreamingAPI(
    messages: LLMMessage[],
    maxTokens: number,
    responseFormat?: { type: string },
  ): Promise<string> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${this.model}`;

    const body: Record<string, unknown> = {
      messages,
      max_tokens: maxTokens,
      stream: true,
    };

    if (responseFormat) {
      body.response_format = responseFormat;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Workers AI request failed (${res.status}): ${errText}`);
    }

    // Parse SSE stream: each line is "data: <json>" with final "data: [DONE]"
    const rawText = await res.text();
    const chunks: string[] = [];

    for (const line of rawText.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6);
      if (payload === "[DONE]") break;

      try {
        const parsed = JSON.parse(payload) as { response?: string };
        if (parsed.response) {
          chunks.push(parsed.response);
        }
      } catch {
        // Skip malformed SSE chunks
      }
    }

    return chunks.join("");
  }
}

// Known claim object field names -- used to fix "key: value" merged into one string
const KNOWN_FIELDS = [
  "exact_quote", "speaker_name", "speaker_role", "session",
  "claim_type", "metric_name", "claimed_value", "claimed_unit",
  "comparison_basis", "gaap_type", "extraction_confidence",
  "verifiable_against_sec_filings",
  // Judge fields
  "accuracy_score", "framing_score", "consistency_score",
  "transparency_score", "overall_score", "verdict",
  "strongest_bull_point", "strongest_bear_point",
  "most_concerning_finding", "strongest_transparency_evidence",
];

function repairJSON(text: string): string {
  let s = text.trim();

  // Strip markdown code fences
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  // Fix bare decimals: ": .95" -> ": 0.95"
  s = s.replace(/:\s*\.(\d)/g, ": 0.$1");

  // Fix merged key:value strings: "comparison_basis: year-over-year" -> "comparison_basis": "year-over-year"
  const fieldPattern = KNOWN_FIELDS.join("|");
  const mergedKeyValueRe = new RegExp(
    `"(${fieldPattern}):\\s*([^"]*?)"\\s*(,|\\}|\\])`,
    "g"
  );
  s = s.replace(mergedKeyValueRe, (_, key, val, after) => {
    const trimmed = val.trim();
    // Determine if the value should be a number, boolean, or null
    if (trimmed === "" || trimmed === "null") return `"${key}": null${after}`;
    if (trimmed === "true" || trimmed === "false") return `"${key}": ${trimmed}${after}`;
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return `"${key}": ${trimmed}${after}`;
    return `"${key}": "${trimmed}"${after}`;
  });

  // Fix missing null values: "key":, or "key": , -> "key": null,
  s = s.replace(/":\s*,/g, '": null,');
  s = s.replace(/":\s*\}/g, '": null}');
  s = s.replace(/":\s*\]/g, '": null]');

  // Fix trailing commas before } or ]
  s = s.replace(/,\s*([\]}])/g, "$1");

  // Fix missing commas between objects in arrays: }{ -> },{
  s = s.replace(/\}(\s*)\{/g, "},$1{");

  // Try direct parse after text repairs
  try {
    JSON.parse(s);
    return s;
  } catch {
    // Fall through to truncation recovery
  }

  // For truncated output: trim back to the last complete object in an array.
  const truncated = truncateToLastCompleteObject(s);
  if (truncated) return truncated;

  // Fallback: brute-force close open brackets/braces
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escape = false;

  for (const ch of s) {
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") openBraces++;
    else if (ch === "}") openBraces--;
    else if (ch === "[") openBrackets++;
    else if (ch === "]") openBrackets--;
  }

  if (inString) s += '"';
  s = s.replace(/,\s*$/, "");
  for (let i = 0; i < openBrackets; i++) s += "]";
  for (let i = 0; i < openBraces; i++) s += "}";

  return s;
}

// Find the last "}" that produces valid JSON when we close remaining brackets.
// Walks backwards through brace positions to salvage truncated output.
function truncateToLastCompleteObject(s: string): string | null {
  const bracePositions: number[] = [];
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "}") bracePositions.push(i);
  }

  for (let i = bracePositions.length - 1; i >= 0; i--) {
    let candidate = s.slice(0, bracePositions[i] + 1);

    // Remove trailing comma before we close
    candidate = candidate.replace(/,\s*$/, "");

    // Count unclosed brackets/braces
    let ob = 0, obt = 0;
    inStr = false;
    esc = false;
    for (const ch of candidate) {
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === "{") ob++;
      else if (ch === "}") ob--;
      else if (ch === "[") obt++;
      else if (ch === "]") obt--;
    }

    let closing = "";
    for (let j = 0; j < obt; j++) closing += "]";
    for (let j = 0; j < ob; j++) closing += "}";

    try {
      JSON.parse(candidate + closing);
      return candidate + closing;
    } catch {
      continue;
    }
  }

  return null;
}
