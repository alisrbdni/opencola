import { TelegramClient } from "./telegram";
import { WhatsAppClient } from "./whatsapp";
import type { IncomingMessage, OutgoingMessage, MessagingConfig } from "@/shared/types";

export type MessageHandler = (msg: IncomingMessage) => Promise<void>;

// ─── Messaging Router ─────────────────────────────────────────────────────────

export class MessagingRouter {
  telegram: TelegramClient;
  whatsapp: WhatsAppClient;
  private handlers: MessageHandler[] = [];

  constructor(config: MessagingConfig) {
    this.telegram = new TelegramClient(config.telegram);
    this.whatsapp = new WhatsAppClient(config.whatsapp);

    // Wire up message dispatch
    this.telegram.onMessage((msg) => this.dispatch(msg));
    this.whatsapp.onMessage((msg) => this.dispatch(msg));
  }

  start(): void {
    if (this.telegram.isEnabled) {
      this.telegram.startPolling();
      console.log("[Messaging] Telegram polling started");
    }
  }

  stop(): void {
    this.telegram.stopPolling();
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  async send(msg: OutgoingMessage): Promise<boolean> {
    if (msg.platform === "telegram") return this.telegram.send(msg);
    if (msg.platform === "whatsapp") return this.whatsapp.send(msg);
    return false;
  }

  /** Send to all configured platforms (broadcast) */
  async broadcast(text: string, parseMode: "markdown" | "html" = "markdown"): Promise<void> {
    const promises: Promise<boolean>[] = [];

    // Telegram — send to all allowed chat IDs
    for (const chatId of this.telegram["config"].allowedChatIds) {
      promises.push(this.telegram.send({ platform: "telegram", chatId, text, parseMode }));
    }

    // WhatsApp — send to all allowed numbers
    for (const number of this.whatsapp["config"].allowedNumbers) {
      promises.push(this.whatsapp.send({ platform: "whatsapp", chatId: number, text }));
    }

    await Promise.allSettled(promises);
  }

  /** Update config at runtime (when settings change) */
  updateConfig(config: MessagingConfig): void {
    this.stop();
    this.telegram = new TelegramClient(config.telegram);
    this.whatsapp = new WhatsAppClient(config.whatsapp);
    this.telegram.onMessage((msg) => this.dispatch(msg));
    this.whatsapp.onMessage((msg) => this.dispatch(msg));
    this.start();
  }

  private async dispatch(msg: IncomingMessage): Promise<void> {
    for (const handler of this.handlers) {
      await handler(msg).catch(console.error);
    }
  }
}
