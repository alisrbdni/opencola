import type { ILLMProvider } from "@/llm/provider-registry";
import type { LLMRequest, LLMResponse, LLMMessage } from "@/shared/types";

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

interface GeminiResponse {
  candidates: Array<{
    content: { parts: GeminiPart[]; role: string };
    finishReason: string;
  }>;
  usageMetadata: { promptTokenCount: number; candidatesTokenCount: number };
  modelVersion: string;
}

/** Recursively remove fields Gemini's function-calling schema doesn't accept */
function stripUnsupportedSchemaFields(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(stripUnsupportedSchemaFields);
  if (typeof schema !== "object" || schema === null) return schema;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (k === "additionalProperties" || k === "$schema") continue;
    out[k] = stripUnsupportedSchemaFields(v);
  }
  return out;
}

export class GeminiProvider implements ILLMProvider {
  readonly id = "gemini" as const;
  readonly name = "Google Gemini";
  private readonly baseUrl = "https://generativelanguage.googleapis.com/v1beta";

  constructor(private apiKey: string) {}

  async testConnection(): Promise<boolean> {
    try {
      const res = await this.complete(
        { messages: [{ role: "user", content: "ping" }], maxTokens: 5 },
        "gemini-2.0-flash"
      );
      return !!res.content;
    } catch {
      return false;
    }
  }

  async complete(request: LLMRequest, modelId: string): Promise<LLMResponse> {
    const contents = this.convertMessages(request.messages);

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 4096,
      },
    };

    if (request.systemPrompt) {
      body["systemInstruction"] = { parts: [{ text: request.systemPrompt }] };
    }

    if (request.tools?.length) {
      body["tools"] = [
        {
          functionDeclarations: request.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: stripUnsupportedSchemaFields(t.parameters),
          })),
        },
      ];
    }

    const url = `${this.baseUrl}/models/${modelId}:generateContent?key=${this.apiKey}`;
    const res = await globalThis.fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${err}`);
    }

    const data = (await res.json()) as GeminiResponse;
    const candidate = data.candidates[0];
    if (!candidate) throw new Error("Gemini returned no candidates");

    const text = candidate.content.parts
      .filter((p): p is { text: string } => "text" in p)
      .map((p) => p.text)
      .join("");

    const funcCalls = candidate.content.parts.filter(
      (p): p is { functionCall: { name: string; args: Record<string, unknown> } } =>
        "functionCall" in p
    );

    return {
      content: text,
      toolCalls: funcCalls.map((fc, i) => ({
        id: `gemini-tool-${i}`,
        type: "function",
        function: {
          name: fc.functionCall.name,
          arguments: JSON.stringify(fc.functionCall.args),
        },
      })),
      usage: {
        promptTokens: data.usageMetadata.promptTokenCount,
        completionTokens: data.usageMetadata.candidatesTokenCount,
      },
      model: data.modelVersion ?? modelId,
      provider: "gemini",
    };
  }

  private convertMessages(messages: LLMMessage[]): GeminiContent[] {
    const result: GeminiContent[] = [];

    for (const msg of messages) {
      if (msg.role === "system") continue;

      if (msg.role === "tool") {
        result.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name: msg.toolCallId ?? "unknown",
                response: { result: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content) },
              },
            },
          ],
        });
        continue;
      }

      const role = msg.role === "assistant" ? "model" : "user";
      const parts: GeminiPart[] = [];

      if (msg.toolCalls?.length) {
        for (const tc of msg.toolCalls) {
          parts.push({
            functionCall: {
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments) as Record<string, unknown>,
            },
          });
        }
      } else if (Array.isArray(msg.content)) {
        for (const p of msg.content) {
          if (p.type === "text") {
            parts.push({ text: p.text });
          } else {
            const [meta, data] = p.image_url.url.split(",");
            const mimeType = meta?.split(":")?.[1]?.split(";")?.[0] ?? "image/png";
            parts.push({ inlineData: { mimeType, data: data ?? "" } });
          }
        }
      } else {
        parts.push({ text: msg.content });
      }

      result.push({ role, parts });
    }

    return result;
  }
}
