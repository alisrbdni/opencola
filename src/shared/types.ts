// ─── Core Agent Types ────────────────────────────────────────────────────────

export type AgentStatus =
  | "idle"
  | "thinking"
  | "acting"
  | "waiting_user"
  | "paused"
  | "error"
  | "completed";

export interface AgentTask {
  id: string;
  goal: string;
  createdAt: number;
  updatedAt: number;
  status: AgentStatus;
  steps: AgentStep[];
  result?: string;
  error?: string;
  source: TaskSource;
  providerId: LLMProviderId;
  modelId: string;
}

export interface AgentStep {
  id: string;
  taskId: string;
  type: StepType;
  input: string;
  output?: string;
  timestamp: number;
  durationMs?: number;
  error?: string;
}

export type StepType =
  | "llm_call"
  | "browser_action"
  | "user_message"
  | "agent_message"
  | "tool_call"
  | "observation";

export type TaskSource = "popup" | "telegram" | "whatsapp" | "alarm" | "api";

// ─── LLM Provider Types ───────────────────────────────────────────────────────

export type LLMProviderId = "openai" | "anthropic" | "gemini" | "groq" | "ollama";

export interface LLMProviderConfig {
  id: LLMProviderId;
  name: string;
  enabled: boolean;
  apiKey: string;
  baseUrl?: string;
  defaultModel: string;
  availableModels: ModelOption[];
}

export interface ModelOption {
  id: string;
  name: string;
  contextWindow: number;
  supportsVision: boolean;
  supportsTools: boolean;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | LLMContentPart[];
  toolCallId?: string;
  toolCalls?: LLMToolCall[];
}

export type LLMContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface LLMToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface LLMTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface LLMRequest {
  messages: LLMMessage[];
  tools?: LLMTool[];
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface LLMResponse {
  content: string;
  toolCalls?: LLMToolCall[];
  usage: { promptTokens: number; completionTokens: number };
  model: string;
  provider: LLMProviderId;
}

// ─── Browser Action Types ─────────────────────────────────────────────────────

export type BrowserActionType =
  | "navigate"
  | "click"
  | "type"
  | "scroll"
  | "screenshot"
  | "extract_dom"
  | "extract_text"
  | "wait"
  | "evaluate_js"
  | "new_tab"
  | "close_tab"
  | "back"
  | "forward"
  | "get_cookies"
  | "set_cookie"
  | "fill_form"
  | "hover"
  | "select_option"
  | "upload_file"
  | "download";

export interface BrowserAction {
  type: BrowserActionType;
  tabId?: number;
  params: Record<string, unknown>;
}

export interface BrowserActionResult {
  success: boolean;
  data?: unknown;
  screenshot?: string; // base64
  error?: string;
}

export interface PageContext {
  url: string;
  title: string;
  screenshot?: string;
  dom?: string;
  interactiveElements?: InteractiveElement[];
}

export interface InteractiveElement {
  index: number;
  type: "button" | "link" | "input" | "select" | "textarea" | "checkbox" | "radio";
  text?: string;
  placeholder?: string;
  href?: string;
  selector: string;
  boundingBox?: DOMRect;
}

// ─── Messaging Types ──────────────────────────────────────────────────────────

export type MessagingProvider = "telegram" | "whatsapp";

export interface MessagingConfig {
  telegram: TelegramConfig;
  whatsapp: WhatsAppConfig;
}

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  allowedChatIds: string[];
  webhookUrl?: string;
  pollingInterval: number; // ms
}

export interface WhatsAppConfig {
  enabled: boolean;
  provider: "twilio" | "waha";
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
  wahaUrl?: string;
  wahaApiKey?: string;
  allowedNumbers: string[];
}

export interface IncomingMessage {
  id: string;
  platform: MessagingProvider;
  chatId: string;
  text: string;
  from: { id: string; name?: string };
  timestamp: number;
  replyToMessageId?: string;
}

export interface OutgoingMessage {
  platform: MessagingProvider;
  chatId: string;
  text: string;
  parseMode?: "markdown" | "html";
  replyToMessageId?: string;
  imageBase64?: string;
}

// ─── Extension Settings ───────────────────────────────────────────────────────

export interface ExtensionSettings {
  providers: LLMProviderConfig[];
  messaging: MessagingConfig;
  agent: AgentSettings;
  ui: UISettings;
}

export interface AgentSettings {
  defaultProviderId: LLMProviderId;
  defaultModelId: string;
  maxStepsPerTask: number;
  stepTimeoutMs: number;
  screenshotEnabled: boolean;
  autonomyLevel: "supervised" | "semi-auto" | "autonomous";
  confirmBeforeActions: boolean;
  systemPrompt: string;
  safetyMode: boolean;
}

export interface UISettings {
  theme: "dark" | "light" | "system";
  compactMode: boolean;
  showStepDetails: boolean;
}

// ─── Chrome Message Protocol ──────────────────────────────────────────────────

export type ChromeMessage =
  | { type: "CREATE_TASK"; payload: { goal: string; source?: TaskSource } }
  | { type: "CANCEL_TASK"; payload: { taskId: string } }
  | { type: "PAUSE_TASK"; payload: { taskId: string } }
  | { type: "RESUME_TASK"; payload: { taskId: string } }
  | { type: "GET_TASKS" }
  | { type: "GET_SETTINGS" }
  | { type: "SAVE_SETTINGS"; payload: { settings: ExtensionSettings } }
  | { type: "GET_PAGE_CONTEXT" }
  | { type: "USER_APPROVAL"; payload: { taskId: string; approved: boolean } }
  | { type: "SEND_MESSAGE"; payload: OutgoingMessage };

export type ChromeResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };
