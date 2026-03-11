import { OpenAIProvider } from "./openai";
import type { ILLMProvider } from "@/llm/provider-registry";
import type { LLMRequest, LLMResponse } from "@/shared/types";

// ─── Groq Provider (OpenAI-compatible) ───────────────────────────────────────

export class GroqProvider implements ILLMProvider {
  readonly id = "groq" as const;
  readonly name = "Groq";

  private delegate: OpenAIProvider;

  constructor(apiKey: string) {
    this.delegate = new OpenAIProvider(apiKey, "https://api.groq.com/openai/v1");
  }

  async testConnection(): Promise<boolean> {
    return this.delegate.testConnection();
  }

  async complete(request: LLMRequest, modelId: string): Promise<LLMResponse> {
    const res = await this.delegate.complete(request, modelId);
    return { ...res, provider: "groq" };
  }

  async listModels(): Promise<Array<{ id: string; name: string }>> {
    return [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile" },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant" },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
      { id: "gemma2-9b-it", name: "Gemma 2 9B" },
    ];
  }
}

// ─── Ollama Provider (local LLMs) ─────────────────────────────────────────────

export class OllamaProvider implements ILLMProvider {
  readonly id = "ollama" as const;
  readonly name = "Ollama (Local)";

  private delegate: OpenAIProvider;

  constructor(baseUrl = "http://localhost:11434") {
    // Ollama's OpenAI-compatible endpoint
    this.delegate = new OpenAIProvider("ollama", `${baseUrl}/v1`);
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await globalThis.fetch(
        this.delegate["baseUrl"].replace("/v1", "/api/tags")
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  async complete(request: LLMRequest, modelId: string): Promise<LLMResponse> {
    const res = await this.delegate.complete(request, modelId);
    return { ...res, provider: "ollama" };
  }

  async listModels(): Promise<Array<{ id: string; name: string }>> {
    try {
      const baseUrl = (this.delegate as unknown as { baseUrl: string }).baseUrl.replace("/v1", "");
      const res = await globalThis.fetch(`${baseUrl}/api/tags`);
      if (!res.ok) return [];
      const data = (await res.json()) as { models: Array<{ name: string }> };
      return data.models.map((m) => ({ id: m.name, name: m.name }));
    } catch {
      return [];
    }
  }
}
