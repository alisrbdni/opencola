import type { ExtensionSettings, LLMProviderId } from "@/shared/types";

const DEFAULT_SETTINGS: ExtensionSettings = {
  providers: [
    {
      id: "openai",
      name: "OpenAI",
      enabled: false,
      apiKey: "",
      defaultModel: "gpt-4o",
      availableModels: [
        { id: "gpt-4o", name: "GPT-4o", contextWindow: 128000, supportsVision: true, supportsTools: true },
        { id: "gpt-4o-mini", name: "GPT-4o Mini", contextWindow: 128000, supportsVision: true, supportsTools: true },
        { id: "gpt-4-turbo", name: "GPT-4 Turbo", contextWindow: 128000, supportsVision: true, supportsTools: true },
        { id: "o1", name: "o1", contextWindow: 200000, supportsVision: false, supportsTools: false },
      ],
    },
    {
      id: "anthropic",
      name: "Anthropic",
      enabled: false,
      apiKey: "",
      defaultModel: "claude-sonnet-4-6",
      availableModels: [
        { id: "claude-opus-4-6", name: "Claude Opus 4.6", contextWindow: 200000, supportsVision: true, supportsTools: true },
        { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", contextWindow: 200000, supportsVision: true, supportsTools: true },
        { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", contextWindow: 200000, supportsVision: true, supportsTools: true },
      ],
    },
    {
      id: "gemini",
      name: "Google Gemini",
      enabled: false,
      apiKey: "",
      defaultModel: "gemini-1.5-pro",
      availableModels: [
        { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", contextWindow: 1000000, supportsVision: true, supportsTools: true },
        { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", contextWindow: 2000000, supportsVision: true, supportsTools: true },
        { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", contextWindow: 1000000, supportsVision: true, supportsTools: true },
      ],
    },
    {
      id: "groq",
      name: "Groq",
      enabled: false,
      apiKey: "",
      defaultModel: "llama-3.3-70b-versatile",
      availableModels: [
        { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", contextWindow: 128000, supportsVision: false, supportsTools: true },
        { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", contextWindow: 128000, supportsVision: false, supportsTools: true },
        { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", contextWindow: 32768, supportsVision: false, supportsTools: true },
      ],
    },
    {
      id: "ollama",
      name: "Ollama (Local)",
      enabled: false,
      apiKey: "",
      baseUrl: "http://localhost:11434",
      defaultModel: "llama3.2",
      availableModels: [
        { id: "llama3.2", name: "Llama 3.2 (local)", contextWindow: 128000, supportsVision: false, supportsTools: true },
        { id: "qwen2.5:14b", name: "Qwen 2.5 14B (local)", contextWindow: 32000, supportsVision: false, supportsTools: true },
        { id: "mistral", name: "Mistral (local)", contextWindow: 32000, supportsVision: false, supportsTools: false },
      ],
    },
  ],
  messaging: {
    telegram: {
      enabled: false,
      botToken: "",
      allowedChatIds: [],
      pollingInterval: 3000,
    },
    whatsapp: {
      enabled: false,
      provider: "twilio",
      twilioAccountSid: "",
      twilioAuthToken: "",
      twilioPhoneNumber: "",
      allowedNumbers: [],
    },
  },
  agent: {
    defaultProviderId: "openai" as LLMProviderId,
    defaultModelId: "gpt-4o",
    maxStepsPerTask: 30,
    stepTimeoutMs: 30_000,
    screenshotEnabled: true,
    autonomyLevel: "supervised",
    confirmBeforeActions: false,
    systemPrompt: "",
  },
  ui: {
    theme: "dark",
    compactMode: false,
    showStepDetails: true,
  },
};

export class SettingsStore {
  static async load(): Promise<ExtensionSettings> {
    const { settings } = await chrome.storage.sync.get("settings");
    if (!settings) return DEFAULT_SETTINGS;
    // Deep merge with defaults to handle new fields
    return deepMerge(DEFAULT_SETTINGS, settings as Partial<ExtensionSettings>);
  }

  static async save(settings: ExtensionSettings): Promise<void> {
    await chrome.storage.sync.set({ settings });
  }

  static getDefaults(): ExtensionSettings {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

function deepMerge<T extends object>(defaults: T, overrides: Partial<T>): T {
  const result = structuredClone(defaults);
  for (const key of Object.keys(overrides) as (keyof T)[]) {
    const val = overrides[key];
    if (val !== undefined) {
      if (typeof val === "object" && !Array.isArray(val) && val !== null) {
        result[key] = deepMerge(result[key] as object, val as object) as T[typeof key];
      } else {
        result[key] = val as T[typeof key];
      }
    }
  }
  return result;
}
