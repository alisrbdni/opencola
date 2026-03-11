/**
 * Background Service Worker — the heart of BrowserAgent
 *
 * Responsibilities:
 * 1. Register all LLM providers
 * 2. Initialize the agent orchestrator
 * 3. Start the messaging router (Telegram / WhatsApp polling)
 * 4. Handle Chrome messages from popup and content scripts
 * 5. Route incoming chat messages → new agent tasks
 * 6. Route agent notifications → correct messaging platform
 */

import { LLMProviderRegistry } from "@/llm/provider-registry";
import { OpenAIProvider } from "@/llm/providers/openai";
import { AnthropicProvider } from "@/llm/providers/anthropic";
import { GeminiProvider } from "@/llm/providers/gemini";
import { GroqProvider, OllamaProvider } from "@/llm/providers/groq-ollama";
import { AgentOrchestrator } from "@/background/agent-orchestrator";
import { SettingsStore } from "@/background/settings-store";
import { MessagingRouter } from "@/messaging/router";
import type {
  ChromeMessage,
  ChromeResponse,
  ExtensionSettings,
  OutgoingMessage,
} from "@/shared/types";

// ─── Singletons ───────────────────────────────────────────────────────────────

const orchestrator = new AgentOrchestrator();
let messagingRouter: MessagingRouter | null = null;

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot(): Promise<void> {
  console.log("[BrowserAgent] Booting...");

  const settings = await SettingsStore.load();

  // Register LLM providers with their API keys
  await registerProviders(settings);

  // Load previously persisted tasks (restore state after SW restart)
  await orchestrator.loadPersistedTasks();

  // Boot messaging
  messagingRouter = new MessagingRouter(settings.messaging);
  messagingRouter.onMessage(async (msg) => {
    console.log(`[Messaging] Received from ${msg.platform}:`, msg.text);

    // Check if this is a reply to a waiting task
    const activeTasks = orchestrator.getAllTasks().filter((t) => t.status === "waiting_user");
    const matchingTask = activeTasks.find(
      (t) =>
        t.source === msg.platform ||
        (t.source === "telegram" && msg.platform === "telegram") ||
        (t.source === "whatsapp" && msg.platform === "whatsapp")
    );

    if (matchingTask) {
      orchestrator.resolveUserInput(matchingTask.id, msg.text);
      return;
    }

    // New task from messaging
    const task = await orchestrator.createTask(msg.text, msg.platform);
    await messagingRouter?.send({
      platform: msg.platform,
      chatId: msg.chatId,
      text: `🤖 *Task received!* I'll work on this for you.\n\nTask ID: \`${task.id.substring(0, 8)}\``,
      parseMode: "markdown",
    });
  });
  messagingRouter.start();

  // Listen for settings changes to re-init providers + messaging
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === "sync" && changes["settings"]) {
      console.log("[BrowserAgent] Settings changed, re-initializing...");
      const newSettings = changes["settings"].newValue as ExtensionSettings;
      await registerProviders(newSettings);
      messagingRouter?.updateConfig(newSettings.messaging);
    }
  });

  // Set up context menu
  chrome.contextMenus.create({
    id: "run-agent",
    title: 'Run Agent on "%s"',
    contexts: ["selection", "page"],
  });

  console.log("[BrowserAgent] Boot complete ✓");
}

// ─── Provider Registration ────────────────────────────────────────────────────

async function registerProviders(settings: ExtensionSettings): Promise<void> {
  for (const config of settings.providers) {
    if (!config.enabled || !config.apiKey) continue;

    try {
      switch (config.id) {
        case "openai":
          LLMProviderRegistry.register(
            new OpenAIProvider(config.apiKey, config.baseUrl)
          );
          break;
        case "anthropic":
          LLMProviderRegistry.register(new AnthropicProvider(config.apiKey));
          break;
        case "gemini":
          LLMProviderRegistry.register(new GeminiProvider(config.apiKey));
          break;
        case "groq":
          LLMProviderRegistry.register(new GroqProvider(config.apiKey));
          break;
        case "ollama":
          LLMProviderRegistry.register(
            new OllamaProvider(config.baseUrl ?? "http://localhost:11434")
          );
          break;
      }
      console.log(`[BrowserAgent] Provider registered: ${config.id}`);
    } catch (err) {
      console.error(`[BrowserAgent] Failed to register provider ${config.id}:`, err);
    }
  }
}

// ─── Chrome Message Handler ───────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: ChromeMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ChromeResponse) => void
  ) => {
    handleMessage(message)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) =>
        sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) })
      );
    return true; // keep message channel open for async response
  }
);

async function handleMessage(message: ChromeMessage): Promise<unknown> {
  switch (message.type) {
    case "CREATE_TASK": {
      const { goal, source = "popup" } = message.payload;
      return orchestrator.createTask(goal, source);
    }

    case "CANCEL_TASK": {
      orchestrator.cancelTask(message.payload.taskId);
      return { cancelled: true };
    }

    case "GET_TASKS": {
      return orchestrator.getAllTasks();
    }

    case "GET_SETTINGS": {
      return SettingsStore.load();
    }

    case "SAVE_SETTINGS": {
      await SettingsStore.save(message.payload.settings);
      return { saved: true };
    }

    case "USER_APPROVAL": {
      const { taskId, approved } = message.payload;
      if (approved) {
        orchestrator.resolveUserInput(taskId, "[User approved — proceed]");
      } else {
        orchestrator.cancelTask(taskId);
      }
      return { processed: true };
    }

    case "SEND_MESSAGE": {
      return messagingRouter?.send(message.payload) ?? false;
    }

    default:
      throw new Error(`Unknown message type: ${(message as { type: string }).type}`);
  }
}

// ─── Agent Notification Handler ───────────────────────────────────────────────
// Receives internal AGENT_NOTIFICATION events from AgentOrchestrator

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.type !== "AGENT_NOTIFICATION") return false;

  const { taskId, text, source } = message.payload as {
    taskId: string;
    text: string;
    source: string;
  };

  // Show Chrome notification
  chrome.notifications.create(`agent-${taskId}-${Date.now()}`, {
    type: "basic",
    iconUrl: "icons/icon48.png",
    title: "BrowserAgent",
    message: text.substring(0, 100),
  });

  // Forward to messaging platform if applicable
  if (source === "telegram" || source === "whatsapp") {
    const task = orchestrator.getTask(taskId);
    if (!task) return false;

    // Find the originating chat ID from task steps
    const outMsg: OutgoingMessage = {
      platform: source as "telegram" | "whatsapp",
      chatId: "", // Will be filled below
      text,
      parseMode: "markdown",
    };

    // Try to get chatId from the first user message step (stored as metadata)
    // In production, you'd store chatId on the task directly
    messagingRouter
      ?.broadcast(text)
      .catch(console.error);
  }

  return false;
});

// ─── Context Menu Handler ─────────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== "run-agent") return;
  const goal = info.selectionText ?? `Analyze this page: ${info.pageUrl}`;
  orchestrator.createTask(goal, "popup").catch(console.error);
});

// ─── Alarm for periodic tasks ─────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "scheduled-check") {
    const settings = await SettingsStore.load();
    // Placeholder: could run scheduled tasks here
    console.log("[BrowserAgent] Alarm fired:", alarm.name, settings);
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

boot().catch(console.error);
