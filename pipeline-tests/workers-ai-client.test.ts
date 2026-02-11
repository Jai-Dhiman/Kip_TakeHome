import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { WorkersAIClient } from "../pipeline/ai/workers-ai-client";
import { AnthropicClient } from "../pipeline/ai/anthropic-client";
import { createPipelineClients } from "../pipeline/ai";

describe("WorkersAIClient", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "test-account-id";
    process.env.CLOUDFLARE_API_TOKEN = "test-api-token";
  });

  afterEach(() => {
    process.env.CLOUDFLARE_ACCOUNT_ID = originalEnv.CLOUDFLARE_ACCOUNT_ID;
    process.env.CLOUDFLARE_API_TOKEN = originalEnv.CLOUDFLARE_API_TOKEN;
  });

  test("constructs with valid env vars", () => {
    const client = new WorkersAIClient();
    expect(client).toBeInstanceOf(WorkersAIClient);
  });

  test("constructs with custom model", () => {
    const client = new WorkersAIClient("@cf/meta/llama-3.1-8b-instruct-fast");
    expect(client).toBeInstanceOf(WorkersAIClient);
  });

  test("throws if CLOUDFLARE_ACCOUNT_ID is missing", () => {
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    expect(() => new WorkersAIClient()).toThrow(
      "CLOUDFLARE_ACCOUNT_ID environment variable is required"
    );
  });

  test("throws if CLOUDFLARE_API_TOKEN is missing", () => {
    delete process.env.CLOUDFLARE_API_TOKEN;
    expect(() => new WorkersAIClient()).toThrow(
      "CLOUDFLARE_API_TOKEN environment variable is required"
    );
  });
});

describe("createPipelineClients", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "test-account-id";
    process.env.CLOUDFLARE_API_TOKEN = "test-api-token";
  });

  afterEach(() => {
    process.env.CLOUDFLARE_ACCOUNT_ID = originalEnv.CLOUDFLARE_ACCOUNT_ID;
    process.env.CLOUDFLARE_API_TOKEN = originalEnv.CLOUDFLARE_API_TOKEN;
    process.env.LLM_PROVIDER = originalEnv.LLM_PROVIDER;
  });

  test("defaults to hybrid: Anthropic extraction+judge, Workers AI debate", () => {
    const clients = createPipelineClients();
    expect(clients.extraction).toBeInstanceOf(AnthropicClient);
    expect(clients.debate).toBeInstanceOf(WorkersAIClient);
    expect(clients.judge).toBeInstanceOf(AnthropicClient);
    expect(clients.extraction).toBe(clients.judge);
  });

  test("workers-ai uses WorkersAIClient for all roles", () => {
    const clients = createPipelineClients("workers-ai");
    expect(clients.extraction).toBeInstanceOf(WorkersAIClient);
    expect(clients.debate).toBeInstanceOf(WorkersAIClient);
    expect(clients.judge).toBeInstanceOf(WorkersAIClient);
  });

  test("anthropic uses same client for all roles", () => {
    const clients = createPipelineClients("anthropic");
    expect(clients.extraction).toBeInstanceOf(AnthropicClient);
    expect(clients.extraction).toBe(clients.debate);
    expect(clients.extraction).toBe(clients.judge);
  });

  test("reads LLM_PROVIDER env var", () => {
    process.env.LLM_PROVIDER = "anthropic";
    const clients = createPipelineClients();
    expect(clients.extraction).toBeInstanceOf(AnthropicClient);
  });

  test("explicit provider overrides env var", () => {
    process.env.LLM_PROVIDER = "workers-ai";
    const clients = createPipelineClients("workers-ai");
    expect(clients.extraction).toBeInstanceOf(WorkersAIClient);
  });
});
