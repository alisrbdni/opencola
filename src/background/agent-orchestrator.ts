import { v4 as uuidv4 } from "uuid";
import { LLMProviderRegistry } from "@/llm/provider-registry";
import { BrowserController } from "@/browser/controller";
import { SettingsStore } from "@/background/settings-store";
import type {
  AgentTask,
  AgentStep,
  AgentStatus,
  LLMMessage,
  LLMTool,
  LLMToolCall,
  BrowserActionType,
  TaskSource,
} from "@/shared/types";

// ─── Built-in browser tools exposed to the LLM ───────────────────────────────

const BROWSER_TOOLS: LLMTool[] = [
  {
    name: "navigate",
    description: "Navigate the browser to a URL",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full URL to navigate to" },
      },
      required: ["url"],
    },
  },
  {
    name: "click",
    description: "Click an element on the page using a CSS selector",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of the element to click" },
      },
      required: ["selector"],
    },
  },
  {
    name: "type",
    description: "Type text into an input field",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of the input element" },
        text: { type: "string", description: "Text to type" },
        clearFirst: { type: "boolean", description: "Clear field before typing", default: true },
      },
      required: ["selector", "text"],
    },
  },
  {
    name: "scroll",
    description: "Scroll the page up or down",
    parameters: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["up", "down"] },
        amount: { type: "number", description: "Pixels to scroll (default 500)" },
      },
      required: ["direction"],
    },
  },
  {
    name: "screenshot",
    description: "Take a screenshot of the current page and return it",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "extract_text",
    description: "Extract visible text from the page or a specific element",
    parameters: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "Optional CSS selector. Omit to get full page text.",
        },
      },
    },
  },
  {
    name: "wait",
    description: "Wait for a number of milliseconds",
    parameters: {
      type: "object",
      properties: {
        ms: { type: "number", description: "Milliseconds to wait" },
      },
      required: ["ms"],
    },
  },
  {
    name: "evaluate_js",
    description: "Execute arbitrary JavaScript on the page and return the result",
    parameters: {
      type: "object",
      properties: {
        script: { type: "string", description: "JavaScript code to execute" },
      },
      required: ["script"],
    },
  },
  {
    name: "new_tab",
    description: "Open a new browser tab",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to open (optional)" },
      },
    },
  },
  {
    name: "select_option",
    description: "Select an option in a <select> element",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string" },
        value: { type: "string", description: "Option value to select" },
      },
      required: ["selector", "value"],
    },
  },
  {
    name: "fill_form",
    description: "Fill multiple form fields at once",
    parameters: {
      type: "object",
      properties: {
        fields: {
          type: "object",
          description: "Map of CSS selector → value to fill",
          additionalProperties: { type: "string" },
        },
      },
      required: ["fields"],
    },
  },
  {
    name: "send_message",
    description:
      "Send a message to the user via their messaging platform (Telegram/WhatsApp) to ask a question or report progress",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "Message text (supports Markdown)" },
        isQuestion: {
          type: "boolean",
          description: "Set to true when you need a response from the user",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "task_complete",
    description: "Signal that the task is fully completed. Provide a summary of what was done.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Summary of what was accomplished" },
      },
      required: ["summary"],
    },
  },
];

// ─── Orchestrator ─────────────────────────────────────────────────────────────

// Tools blocked when safety mode is enabled
const SAFETY_BLOCKED_TOOLS = new Set(["fill_form", "evaluate_js"]);

export class AgentOrchestrator {
  private tasks = new Map<string, AgentTask>();
  private browser = new BrowserController();
  private userInputResolvers = new Map<string, (input: string) => void>();
  private pauseResolvers = new Map<string, () => void>();

  // ── Task Lifecycle ──────────────────────────────────────────────────────────

  async createTask(
    goal: string,
    source: TaskSource = "popup"
  ): Promise<AgentTask> {
    const settings = await SettingsStore.load();
    const task: AgentTask = {
      id: uuidv4(),
      goal,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "idle",
      steps: [],
      source,
      providerId: settings.agent.defaultProviderId,
      modelId: settings.agent.defaultModelId,
    };

    this.tasks.set(task.id, task);
    this.persistTasks();

    // Run asynchronously — don't block the caller
    void this.runTask(task);

    return task;
  }

  getTask(id: string): AgentTask | undefined {
    return this.tasks.get(id);
  }

  getAllTasks(): AgentTask[] {
    return [...this.tasks.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  cancelTask(id: string): void {
    const task = this.tasks.get(id);
    if (task && (task.status === "thinking" || task.status === "acting" || task.status === "waiting_user" || task.status === "paused")) {
      this.updateTask(task, { status: "error", error: "Cancelled by user" });
      // Unblock any waiting resolvers
      this.pauseResolvers.get(id)?.();
      this.pauseResolvers.delete(id);
      this.userInputResolvers.get(id)?.("[Cancelled]");
      this.userInputResolvers.delete(id);
    }
  }

  pauseTask(id: string): void {
    const task = this.tasks.get(id);
    if (task && (task.status === "thinking" || task.status === "acting")) {
      this.updateTask(task, { status: "paused" });
    }
  }

  resumeTask(id: string): void {
    const task = this.tasks.get(id);
    if (task && task.status === "paused") {
      this.updateTask(task, { status: "thinking" });
      const resolver = this.pauseResolvers.get(id);
      if (resolver) {
        resolver();
        this.pauseResolvers.delete(id);
      }
    }
  }

  /** Called when the user sends a reply (from Telegram/WhatsApp/popup) */
  resolveUserInput(taskId: string, input: string): void {
    const resolver = this.userInputResolvers.get(taskId);
    if (resolver) {
      resolver(input);
      this.userInputResolvers.delete(taskId);
    }
  }

  // ── Core ReAct Loop ─────────────────────────────────────────────────────────

  private async runTask(task: AgentTask): Promise<void> {
    const settings = await SettingsStore.load();
    const providerConfig = settings.providers.find((p) => p.id === task.providerId);

    if (!providerConfig?.enabled || !providerConfig.apiKey) {
      this.updateTask(task, {
        status: "error",
        error: `Provider '${task.providerId}' is not configured`,
      });
      return;
    }

    this.updateTask(task, { status: "thinking" });

    // Get initial page context
    const pageCtx = await this.browser
      .getActivePageContext(settings.agent.screenshotEnabled)
      .catch(() => null);

    const systemPrompt = buildSystemPrompt(settings.agent.systemPrompt, pageCtx);

    const messages: LLMMessage[] = [
      {
        role: "user",
        content: `Your task is: ${task.goal}\n\nCurrent page: ${pageCtx?.url ?? "unknown"}\n\nPage content:\n${pageCtx?.dom ?? "No page content available"}`,
      },
    ];

    // Add screenshot if available
    if (pageCtx?.screenshot) {
      const lastMsg = messages[messages.length - 1]!;
      lastMsg.content = [
        { type: "text", text: lastMsg.content as string },
        { type: "image_url", image_url: { url: pageCtx.screenshot } },
      ];
    }

    let stepCount = 0;
    const maxSteps = settings.agent.maxStepsPerTask;

    while (stepCount < maxSteps && task.status !== "completed" && task.status !== "error") {
      stepCount++;

      // Check if paused — wait for resume
      if (task.status === "paused") {
        await new Promise<void>((resolve) => {
          this.pauseResolvers.set(task.id, resolve);
        });
      }

      // Check task wasn't cancelled
      const current = this.tasks.get(task.id);
      if (!current || current.status === "error") break;

      this.updateTask(task, { status: "thinking" });

      // ── LLM call ────────────────────────────────────────────────────────────
      const llmStep = this.addStep(task, "llm_call", JSON.stringify({ messageCount: messages.length }));

      let llmResponse;
      try {
        const provider = LLMProviderRegistry.get(providerConfig.id);
        llmResponse = await provider.complete(
          { messages, tools: BROWSER_TOOLS, systemPrompt, maxTokens: 2048 },
          providerConfig.defaultModel
        );
      } catch (err) {
        this.finishStep(llmStep, undefined, err instanceof Error ? err.message : String(err));
        this.updateTask(task, { status: "error", error: String(err) });
        break;
      }

      this.finishStep(llmStep, llmResponse.content);

      // Push assistant response to conversation
      messages.push({
        role: "assistant",
        content: llmResponse.content,
        ...(llmResponse.toolCalls !== undefined && { toolCalls: llmResponse.toolCalls }),
      });

      // If no tool calls, the agent is done (unexpected) — treat as completion
      if (!llmResponse.toolCalls?.length) {
        this.updateTask(task, { status: "completed", result: llmResponse.content });
        await this.notifyUser(task, `✅ Task complete: ${llmResponse.content}`);
        break;
      }

      // ── Tool execution loop ─────────────────────────────────────────────────
      this.updateTask(task, { status: "acting" });

      for (const toolCall of llmResponse.toolCalls) {
        const result = await this.executeTool(task, toolCall, messages);

        // task_complete signals done
        if (toolCall.function.name === "task_complete") break;

        // user question — wait for reply
        if (toolCall.function.name === "send_message") {
          const args = JSON.parse(toolCall.function.arguments) as { text: string; isQuestion?: boolean };
          if (args.isQuestion) {
            this.updateTask(task, { status: "waiting_user" });
            const userReply = await this.waitForUserInput(task.id);
            this.updateTask(task, { status: "acting" });
            messages.push({ role: "user", content: userReply });
          }
        }

        // Add tool result to conversation
        messages.push({
          role: "tool",
          content: typeof result === "string" ? result : JSON.stringify(result),
          toolCallId: toolCall.id,
        });
      }

      // Check if task_complete was called
      const lastAssistantMsg = messages[messages.length - 1];
      if (
        typeof lastAssistantMsg?.content === "string" &&
        lastAssistantMsg.content.includes("task_complete")
      ) {
        break;
      }
    }

    // If we hit max steps without completion
    if (task.status === "thinking" || task.status === "acting") {
      this.updateTask(task, {
        status: "error",
        error: `Reached maximum step limit (${maxSteps})`,
      });
    }
  }

  // ── Tool Execution ──────────────────────────────────────────────────────────

  private async executeTool(
    task: AgentTask,
    toolCall: LLMToolCall,
    _messages: LLMMessage[]
  ): Promise<unknown> {
    const name = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
    const step = this.addStep(task, "tool_call", JSON.stringify({ tool: name, args }));

    try {
      let result: unknown;

      // Safety mode: block potentially dangerous tools
      const settings = await SettingsStore.load();
      if (settings.agent.safetyMode && SAFETY_BLOCKED_TOOLS.has(name)) {
        const msg = `[Safety Mode] Tool '${name}' is blocked. Disable safety mode in settings to allow this action.`;
        this.finishStep(step, msg);
        return msg;
      }

      if (name === "task_complete") {
        const summary = args["summary"] as string;
        this.finishStep(step, summary);
        this.updateTask(task, { status: "completed", result: summary });
        await this.notifyUser(task, `✅ *Task complete!*\n\n${summary}`);
        return summary;
      }

      if (name === "send_message") {
        const text = args["text"] as string;
        await this.notifyUser(task, text);
        this.finishStep(step, "Message sent");
        return "Message sent to user";
      }

      // Browser actions
      const browserResult = await this.browser.execute({
        type: name as BrowserActionType,
        params: args,
      });

      if (browserResult.screenshot) {
        // Attach screenshot to the next LLM message
        result = `Action succeeded. Screenshot taken.`;
        // The screenshot will be included in the tool result as a URL for providers that support it
      } else {
        result = browserResult.success
          ? (browserResult.data ?? "Action completed successfully")
          : `Error: ${browserResult.error}`;
      }

      this.finishStep(step, JSON.stringify(result));
      return result;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.finishStep(step, undefined, errMsg);
      return `Tool error: ${errMsg}`;
    }
  }

  // ── User Messaging ──────────────────────────────────────────────────────────

  private async notifyUser(task: AgentTask, text: string): Promise<void> {
    chrome.runtime.sendMessage({
      type: "AGENT_NOTIFICATION",
      payload: { taskId: task.id, text, source: task.source },
    });
  }

  private waitForUserInput(taskId: string): Promise<string> {
    return new Promise((resolve) => {
      // Timeout after 5 minutes
      const timer = setTimeout(() => {
        this.userInputResolvers.delete(taskId);
        resolve("[User did not respond within 5 minutes, proceeding with best judgment]");
      }, 5 * 60 * 1000);

      this.userInputResolvers.set(taskId, (input) => {
        clearTimeout(timer);
        resolve(input);
      });
    });
  }

  // ── State Helpers ───────────────────────────────────────────────────────────

  private updateTask(task: AgentTask, updates: Partial<AgentTask>): void {
    Object.assign(task, { ...updates, updatedAt: Date.now() });
    this.tasks.set(task.id, task);
    this.persistTasks();

    // Broadcast to popup
    chrome.runtime
      .sendMessage({ type: "TASK_UPDATED", payload: task })
      .catch(() => {}); // popup might be closed
  }

  private addStep(task: AgentTask, type: AgentStep["type"], input: string): AgentStep {
    const step: AgentStep = {
      id: uuidv4(),
      taskId: task.id,
      type,
      input,
      timestamp: Date.now(),
    };
    task.steps.push(step);
    return step;
  }

  private finishStep(step: AgentStep, output?: string, error?: string): void {
    if (output !== undefined) step.output = output;
    if (error !== undefined) step.error = error;
    step.durationMs = Date.now() - step.timestamp;
  }

  private persistTasks(): void {
    const tasks = [...this.tasks.values()].slice(-50); // keep last 50 tasks
    chrome.storage.local.set({ tasks }).catch(console.error);
  }

  async loadPersistedTasks(): Promise<void> {
    const { tasks } = await chrome.storage.local.get("tasks");
    if (Array.isArray(tasks)) {
      for (const task of tasks as AgentTask[]) {
        // Mark in-flight tasks as errored after restart
        if (task.status === "thinking" || task.status === "acting") {
          task.status = "error";
          task.error = "Extension restarted";
        }
        this.tasks.set(task.id, task);
      }
    }
  }
}

// ─── System Prompt Builder ────────────────────────────────────────────────────

function buildSystemPrompt(
  userSystemPrompt: string,
  pageCtx: { url?: string; title?: string; interactiveElements?: unknown[] } | null
): string {
  const interactiveElsText =
    pageCtx?.interactiveElements && pageCtx.interactiveElements.length > 0
      ? `\nInteractive elements on current page:\n${JSON.stringify(pageCtx.interactiveElements, null, 2)}`
      : "";

  return `You are BrowserAgent, an autonomous AI assistant that controls the user's Chrome browser to complete tasks.

${userSystemPrompt ? `Custom instructions: ${userSystemPrompt}\n` : ""}

## Capabilities
You have access to browser tools: navigate, click, type, scroll, screenshot, extract_text, evaluate_js, fill_form, select_option, wait, new_tab, and send_message.

## Workflow
1. Analyze the task and current page state
2. Plan the steps needed
3. Execute tools one by one, observing results
4. Use send_message to ask the user for clarification or credentials when needed
5. Call task_complete when done with a clear summary

## Guidelines
- Always prefer clicking visible elements using accurate CSS selectors
- Take a screenshot after major navigation to verify the page loaded correctly
- If a selector fails, try extract_text to understand the current page structure
- For sensitive actions (form submissions, purchases), confirm with the user via send_message first
- Keep send_message updates concise and informative
- Never guess credentials — always ask via send_message
- If stuck, explain the situation via send_message and ask for guidance

## Current Context
URL: ${pageCtx?.url ?? "unknown"}
Title: ${pageCtx?.title ?? "unknown"}${interactiveElsText}
`;
}
