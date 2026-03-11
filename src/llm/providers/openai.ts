import type { ILLMProvider } from "@/llm/provider-registry";
import type { LLMRequest, LLMResponse, LLMMessage } from "@/shared/types";

interface OpenAIMessage {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface OpenAICompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };
  }>;
  usage: { prompt_tokens: number; completion_tokens: number };
}

export class OpenAIProvider implements ILLMProvider {
  readonly id = "openai" as const;
  readonly name = "OpenAI";

  constructor(
    private apiKey: string,
    private baseUrl = "https://api.openai.com/v1"
  ) {}

  async testConnection(): Promise<boolean> {
    try {
      const res = await this.fetch("/models", { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  }

  async complete(request: LLMRequest, modelId: string): Promise<LLMResponse> {
    const messages: OpenAIMessage[] = [];

    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }

    for (const msg of request.messages) {
      messages.push(this.convertMessage(msg));
    }

    const body: Record<string, unknown> = {
      model: modelId,
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4096,
    };

    if (request.tools?.length) {
      body["tools"] = request.tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      body["tool_choice"] = "auto";
    }

    const res = await this.fetch("/chat/completions", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${err}`);
    }

    const data = (await res.json()) as OpenAICompletionResponse;
    const choice = data.choices[0];
    if (!choice) throw new Error("OpenAI returned no choices");

    const toolCalls = choice.message.tool_calls?.map((tc) => ({
      id: tc.id,
      type: "function" as const,
      function: tc.function,
    }));
    return {
      content: choice.message.content ?? "",
      ...(toolCalls !== undefined && { toolCalls }),
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
      },
      model: data.model,
      provider: "openai",
    };
  }

  async listModels(): Promise<Array<{ id: string; name: string }>> {
    const res = await this.fetch("/models", { method: "GET" });
    if (!res.ok) return [];
    const data = (await res.json()) as { data: Array<{ id: string }> };
    return data.data
      .filter((m) => m.id.startsWith("gpt-") || m.id.startsWith("o1"))
      .map((m) => ({ id: m.id, name: m.id }));
  }

  private convertMessage(msg: LLMMessage): OpenAIMessage {
    if (msg.role === "tool") {
      return {
        role: "tool",
        content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
        tool_call_id: msg.toolCallId ?? "",
      };
    }

    if (msg.toolCalls?.length) {
      return {
        role: "assistant",
        content: typeof msg.content === "string" ? msg.content : "",
        tool_calls: msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: tc.function,
        })),
      };
    }

    if (Array.isArray(msg.content)) {
      return {
        role: msg.role,
        content: msg.content.map((p) => {
          if (p.type === "text") return { type: "text", text: p.text };
          return { type: "image_url", image_url: { url: p.image_url.url } };
        }),
      };
    }

    return { role: msg.role, content: msg.content };
  }

  private async fetch(path: string, init: RequestInit): Promise<Response> {
    return globalThis.fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...(init.headers ?? {}),
      },
    });
  }
}
