import type {
  LLMProviderId,
  LLMProviderConfig,
  LLMRequest,
  LLMResponse,
} from "@/shared/types";

// ─── Abstract Provider Interface ──────────────────────────────────────────────

export interface ILLMProvider {
  readonly id: LLMProviderId;
  readonly name: string;

  /** Test the connection with the stored API key */
  testConnection(): Promise<boolean>;

  /** Core completion method */
  complete(request: LLMRequest, modelId: string): Promise<LLMResponse>;

  /** List available models (optional — falls back to config) */
  listModels?(): Promise<Array<{ id: string; name: string }>>;
}

// ─── Provider Registry ────────────────────────────────────────────────────────

export class LLMProviderRegistry {
  private static providers = new Map<LLMProviderId, ILLMProvider>();

  static register(provider: ILLMProvider): void {
    this.providers.set(provider.id, provider);
    console.log(`[LLMRegistry] Registered provider: ${provider.id}`);
  }

  static get(id: LLMProviderId): ILLMProvider {
    const p = this.providers.get(id);
    if (!p) throw new Error(`LLM provider '${id}' not found in registry`);
    return p;
  }

  static has(id: LLMProviderId): boolean {
    return this.providers.has(id);
  }

  static list(): ILLMProvider[] {
    return [...this.providers.values()];
  }

  static async complete(
    config: LLMProviderConfig,
    request: LLMRequest
  ): Promise<LLMResponse> {
    const provider = this.get(config.id);
    return provider.complete(request, config.defaultModel);
  }
}

// ─── Helper: Normalize tool calls across providers ────────────────────────────

export function parseToolCallArguments(args: string): Record<string, unknown> {
  try {
    return JSON.parse(args) as Record<string, unknown>;
  } catch {
    console.warn("[LLMRegistry] Failed to parse tool arguments:", args);
    return {};
  }
}
