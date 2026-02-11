import Anthropic from "@anthropic-ai/sdk";
import type { LLMClient, LLMMessage } from "./llm-client";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export class AnthropicClient implements LLMClient {
  private client: Anthropic;
  private model: string;

  constructor(model: string = DEFAULT_MODEL) {
    this.client = new Anthropic();
    this.model = model;
  }

  async chat(messages: LLMMessage[], maxTokens: number = 4096): Promise<string> {
    const systemMsg = messages.find((m) => m.role === "system");
    const nonSystem = messages.filter((m) => m.role !== "system");

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system: systemMsg?.content,
      messages: nonSystem.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const block = response.content[0];
    return block?.type === "text" ? block.text : "";
  }

  async chatJSON<T>(
    messages: LLMMessage[],
    maxTokens: number = 4096,
    toolName: string = "submit_result",
    toolDescription: string = "Submit the structured result.",
    inputSchema?: Record<string, unknown>
  ): Promise<T> {
    const systemMsg = messages.find((m) => m.role === "system");
    const nonSystem = messages.filter((m) => m.role !== "system");

    const schema = inputSchema ?? {
      type: "object" as const,
      properties: {},
      additionalProperties: true,
    };

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system: systemMsg?.content,
      tools: [
        {
          name: toolName,
          description: toolDescription,
          input_schema: schema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: toolName },
      messages: nonSystem.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    for (const block of response.content) {
      if (block.type === "tool_use" && block.name === toolName) {
        return block.input as T;
      }
    }

    throw new Error(`No tool_use block found for ${toolName} in Anthropic response`);
  }
}
