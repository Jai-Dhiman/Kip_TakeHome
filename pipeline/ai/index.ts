import { AnthropicClient } from "./anthropic-client";
import type { LLMClient } from "./llm-client";
import { WorkersAIClient } from "./workers-ai-client";

export type LLMProvider = "workers-ai" | "anthropic" | "hybrid";

// Workers AI model for cheap text generation tasks
const DEBATE_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast"; // 128k ctx, fast + cheap

export interface PipelineClients {
	extraction: LLMClient;
	debate: LLMClient;
	judge: LLMClient;
}

export function createPipelineClients(provider?: LLMProvider): PipelineClients {
	const resolved =
		provider ?? (process.env.LLM_PROVIDER as LLMProvider) ?? "hybrid";

	switch (resolved) {
		case "anthropic": {
			const client = new AnthropicClient();
			return { extraction: client, debate: client, judge: client };
		}
		case "workers-ai":
			return {
				extraction: new WorkersAIClient(DEBATE_MODEL),
				debate: new WorkersAIClient(DEBATE_MODEL),
				judge: new WorkersAIClient(DEBATE_MODEL),
			};
		case "hybrid": {
			// Anthropic for extraction + judge (structured output, reliable)
			// Workers AI for debate (cheap text generation)
			const anthropic = new AnthropicClient();
			return {
				extraction: anthropic,
				debate: new WorkersAIClient(DEBATE_MODEL),
				judge: anthropic,
			};
		}
		default:
			throw new Error(`Unknown LLM provider: ${resolved}`);
	}
}

export { AnthropicClient } from "./anthropic-client";
export type { LLMClient, LLMMessage } from "./llm-client";
export { WorkersAIClient } from "./workers-ai-client";
