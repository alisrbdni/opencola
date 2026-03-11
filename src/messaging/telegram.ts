import type { IncomingMessage, OutgoingMessage, TelegramConfig } from "@/shared/types";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name?: string; username?: string };
    chat: { id: number };
    text?: string;
    date: number;
  };
}

interface TelegramGetUpdatesResponse {
  ok: boolean;
  result: TelegramUpdate[];
}

// ─── Telegram Bot Client ──────────────────────────────────────────────────────

export class TelegramClient {
  private lastUpdateId = 0;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private messageHandlers: Array<(msg: IncomingMessage) => void> = [];

  constructor(private config: TelegramConfig) {}

  get isEnabled(): boolean {
    return this.config.enabled && !!this.config.botToken;
  }

  onMessage(handler: (msg: IncomingMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  startPolling(): void {
    if (this.pollingTimer) return;
    console.log("[Telegram] Starting polling...");

    this.pollingTimer = setInterval(async () => {
      if (!this.isEnabled) return;
      await this.poll();
    }, this.config.pollingInterval);
  }

  stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  async send(msg: OutgoingMessage): Promise<boolean> {
    if (!this.isEnabled) return false;

    const body: Record<string, unknown> = {
      chat_id: msg.chatId,
      text: msg.text,
      parse_mode: msg.parseMode === "markdown" ? "Markdown" : msg.parseMode === "html" ? "HTML" : undefined,
    };

    if (msg.replyToMessageId) {
      body["reply_to_message_id"] = msg.replyToMessageId;
    }

    // Send photo if available
    if (msg.imageBase64) {
      return this.sendPhoto(msg.chatId, msg.imageBase64, msg.text);
    }

    return this.apiCall("sendMessage", body);
  }

  async sendPhoto(chatId: string, imageBase64: string, caption?: string): Promise<boolean> {
    // Build multipart form data manually since we can't use Node's FormData
    const boundary = `----FormBoundary${Date.now()}`;
    const body = buildMultipartBody(boundary, {
      chat_id: chatId,
      caption: caption ?? "",
    }, imageBase64);

    const res = await this.rawFetch(`sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body,
    });
    return res.ok;
  }

  async testConnection(): Promise<{ ok: boolean; botName?: string }> {
    try {
      const res = await this.rawFetch("getMe", { method: "GET" });
      if (!res.ok) return { ok: false };
      const data = (await res.json()) as { ok: boolean; result?: { first_name?: string } };
      const botName = data.result?.first_name;
      return { ok: data.ok, ...(botName !== undefined && { botName }) };
    } catch {
      return { ok: false };
    }
  }

  private async poll(): Promise<void> {
    try {
      const params = new URLSearchParams({
        offset: String(this.lastUpdateId + 1),
        timeout: "0",
        limit: "10",
      });

      const res = await this.rawFetch(`getUpdates?${params}`, { method: "GET" });
      if (!res.ok) return;

      const data = (await res.json()) as TelegramGetUpdatesResponse;
      if (!data.ok || !data.result.length) return;

      for (const update of data.result) {
        this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);

        if (!update.message?.text) continue;

        const chatId = String(update.message.chat.id);

        // Enforce allowlist
        if (
          this.config.allowedChatIds.length > 0 &&
          !this.config.allowedChatIds.includes(chatId)
        ) {
          await this.apiCall("sendMessage", {
            chat_id: chatId,
            text: "⛔ You are not authorized to use this bot.",
          });
          continue;
        }

        const senderName = update.message.from.first_name ?? update.message.from.username;
        const incoming: IncomingMessage = {
          id: String(update.message.message_id),
          platform: "telegram",
          chatId,
          text: update.message.text,
          from: {
            id: String(update.message.from.id),
            ...(senderName !== undefined && { name: senderName }),
          },
          timestamp: update.message.date * 1000,
        };

        for (const handler of this.messageHandlers) {
          handler(incoming);
        }
      }
    } catch (err) {
      console.error("[Telegram] Polling error:", err);
    }
  }

  private async apiCall(method: string, body: Record<string, unknown>): Promise<boolean> {
    const res = await this.rawFetch(method, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  }

  private rawFetch(path: string, init: RequestInit): Promise<Response> {
    const url = `https://api.telegram.org/bot${this.config.botToken}/${path}`;
    return globalThis.fetch(url, init);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMultipartBody(
  boundary: string,
  fields: Record<string, string>,
  imageBase64: string
): string {
  const lines: string[] = [];

  for (const [name, value] of Object.entries(fields)) {
    lines.push(`--${boundary}`);
    lines.push(`Content-Disposition: form-data; name="${name}"`);
    lines.push("");
    lines.push(value);
  }

  lines.push(`--${boundary}`);
  lines.push(`Content-Disposition: form-data; name="photo"; filename="screenshot.jpg"`);
  lines.push("Content-Type: image/jpeg");
  lines.push(`Content-Transfer-Encoding: base64`);
  lines.push("");
  lines.push(imageBase64.replace(/^data:image\/\w+;base64,/, ""));
  lines.push(`--${boundary}--`);

  return lines.join("\r\n");
}
