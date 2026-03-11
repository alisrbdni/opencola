import type { ILLMProvider } from "@/llm/provider-registry";
import type { LLMRequest, LLMResponse, LLMMessage } from "@/shared/types";

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentPart[];
}

type AnthropicContentPart =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

interface AnthropicResponse {
  id: string;
  model: string;
  content: AnthropicContentPart[];
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

export class AnthropicProvider implements ILLMProvider {
  readonly id = "anthropic" as const;
  readonly name = "Anthropic";
  private readonly baseUrl = "https://api.anthropic.com/v1";
  private readonly apiVersion = "2023-06-01";

  constructor(private apiKey: string) {}

  async testConnection(): Promise<boolean> {
    try {
      const res = await this.complete(
        { messages: [{ role: "user", content: "ping" }], maxTokens: 5 },
        "claude-haiku-4-5-20251001"
      );
      return !!res.content;
    } catch {
      return false;
    }
  }

  async complete(request: LLMRequest, modelId: string): Promise<LLMResponse> {
    const messages = this.convertMessages(request.messages);

    const body: Record<string, unknown> = {
      model: modelId,
      messages,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.7,
    };

    if (request.systemPrompt) {
      body["system"] = request.systemPrompt;
    }

    if (request.tools?.length) {
      body["tools"] = request.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    const res = await this.fetch("/messages", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${err}`);
    }

    const data = (await res.json()) as AnthropicResponse;

    const textContent = data.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("");

    const toolUses = data.content.filter(
      (c): c is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
        c.type === "tool_use"
    );

    return {
      content: textContent,
      toolCalls: toolUses.map((tu) => ({
        id: tu.id,
        type: "function",
        function: { name: tu.name, arguments: JSON.stringify(tu.input) },
      })),
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
      },
      model: data.model,
      provider: "anthropic",
    };
  }

  private convertMessages(messages: LLMMessage[]): AnthropicMessage[] {
    const result: AnthropicMessage[] = [];

    for (const msg of messages) {
      if (msg.role === "system") continue; // handled via system field

      if (msg.role === "tool") {
        // Tool results must be bundled as user messages
        const last = result[result.length - 1];
        const part: AnthropicContentPart = {
          type: "tool_result",
          tool_use_id: msg.toolCallId ?? "",
          content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
        };
        if (last?.role === "user" && Array.isArray(last.content)) {
          last.content.push(part);
        } else {
          result.push({ role: "user", content: [part] });
        }
        continue;
      }

      if (msg.toolCalls?.length) {
        const parts: AnthropicContentPart[] = [];
        if (msg.content) {
          parts.push({ type: "text", text: typeof msg.content === "string" ? msg.content : "" });
        }
        for (const tc of msg.toolCalls) {
          parts.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments) as Record<string, unknown>,
          });
        }
        result.push({ role: "assistant", content: parts });
        continue;
      }

      if (Array.isArray(msg.content)) {
        const parts: AnthropicContentPart[] = msg.content.map((p) => {
          if (p.type === "text") return { type: "text", text: p.text };
          // Extract base64 from data URL
          const [meta, data] = p.image_url.url.split(",");
          const mediaType = meta?.split(":")?.[1]?.split(";")?.[0] ?? "image/png";
          return {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: data ?? "" },
          };
        });
        result.push({ role: msg.role as "user" | "assistant", content: parts });
      } else {
        result.push({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        });
      }
    }

    return result;
  }

  private async fetch(path: string, init: RequestInit): Promise<Response> {
    return globalThis.fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": this.apiVersion,
        "anthropic-dangerous-allow-browser": "true",
        ...(init.headers ?? {}),
      },
    });
  }
}
