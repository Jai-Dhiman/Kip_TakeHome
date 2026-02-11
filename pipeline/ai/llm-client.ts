export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMClient {
  chat(messages: LLMMessage[], maxTokens?: number): Promise<string>;
  chatJSON<T>(messages: LLMMessage[], maxTokens?: number): Promise<T>;
}
