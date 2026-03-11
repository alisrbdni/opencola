import type { IncomingMessage, OutgoingMessage, WhatsAppConfig } from "@/shared/types";

// ─── WhatsApp Client (Twilio or WAHA) ────────────────────────────────────────

export class WhatsAppClient {
  private messageHandlers: Array<(msg: IncomingMessage) => void> = [];

  constructor(private config: WhatsAppConfig) {}

  get isEnabled(): boolean {
    return this.config.enabled;
  }

  onMessage(handler: (msg: IncomingMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  /** Dispatch a message from a webhook (called by background.ts) */
  handleWebhookMessage(raw: unknown): void {
    const msg = this.parseWebhookPayload(raw);
    if (!msg) return;

    // Enforce allowlist
    if (
      this.config.allowedNumbers.length > 0 &&
      !this.config.allowedNumbers.includes(msg.from.id)
    ) {
      console.warn("[WhatsApp] Blocked message from non-allowed number:", msg.from.id);
      return;
    }

    for (const handler of this.messageHandlers) {
      handler(msg);
    }
  }

  async send(msg: OutgoingMessage): Promise<boolean> {
    if (!this.isEnabled) return false;

    if (this.config.provider === "twilio") {
      return this.sendViaTwilio(msg);
    } else {
      return this.sendViaWAHA(msg);
    }
  }

  async testConnection(): Promise<{ ok: boolean; info?: string }> {
    try {
      if (this.config.provider === "waha") {
        const res = await globalThis.fetch(`${this.config.wahaUrl}/api/health`, {
          headers: { "X-Api-Key": this.config.wahaApiKey ?? "" },
        });
        return { ok: res.ok, info: "WAHA connected" };
      }

      // Twilio — check account
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.config.twilioAccountSid}.json`;
      const res = await globalThis.fetch(url, {
        headers: {
          Authorization: `Basic ${btoa(`${this.config.twilioAccountSid}:${this.config.twilioAuthToken}`)}`,
        },
      });
      return { ok: res.ok, info: "Twilio connected" };
    } catch {
      return { ok: false };
    }
  }

  // ── Twilio ────────────────────────────────────────────────────────────────

  private async sendViaTwilio(msg: OutgoingMessage): Promise<boolean> {
    const { twilioAccountSid, twilioAuthToken, twilioPhoneNumber } = this.config;
    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error("[WhatsApp/Twilio] Missing credentials");
      return false;
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const formData = new URLSearchParams({
      From: `whatsapp:${twilioPhoneNumber}`,
      To: `whatsapp:${msg.chatId}`,
      Body: msg.text,
    });

    if (msg.imageBase64) {
      // Twilio needs a public URL for media — in practice you'd upload to a CDN first
      console.warn("[WhatsApp/Twilio] Image sending requires a public URL, skipping image");
    }

    const res = await globalThis.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
      },
      body: formData.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[WhatsApp/Twilio] Send error:", err);
    }
    return res.ok;
  }

  // ── WAHA (WhatsApp HTTP API — self-hosted) ─────────────────────────────────

  private async sendViaWAHA(msg: OutgoingMessage): Promise<boolean> {
    const { wahaUrl, wahaApiKey } = this.config;
    if (!wahaUrl) return false;

    const body: Record<string, unknown> = {
      chatId: `${msg.chatId}@c.us`,
      text: msg.text,
    };

    const endpoint = msg.imageBase64
      ? `${wahaUrl}/api/sendImage`
      : `${wahaUrl}/api/sendText`;

    if (msg.imageBase64) {
      body["file"] = {
        mimetype: "image/jpeg",
        filename: "screenshot.jpg",
        data: msg.imageBase64.replace(/^data:image\/\w+;base64,/, ""),
      };
      body["caption"] = msg.text;
      delete body["text"];
    }

    const res = await globalThis.fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": wahaApiKey ?? "",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[WhatsApp/WAHA] Send error:", err);
    }
    return res.ok;
  }

  // ── Webhook Parsing ───────────────────────────────────────────────────────

  private parseWebhookPayload(raw: unknown): IncomingMessage | null {
    try {
      if (this.config.provider === "twilio") {
        return this.parseTwilioPayload(raw as Record<string, string>);
      }
      return this.parseWAHAPayload(raw as Record<string, unknown>);
    } catch (err) {
      console.error("[WhatsApp] Failed to parse webhook payload:", err);
      return null;
    }
  }

  private parseTwilioPayload(payload: Record<string, string>): IncomingMessage | null {
    const from = payload["From"]?.replace("whatsapp:", "") ?? "";
    const body = payload["Body"] ?? "";
    if (!from || !body) return null;

    return {
      id: payload["MessageSid"] ?? `twilio-${Date.now()}`,
      platform: "whatsapp",
      chatId: from,
      text: body,
      from: { id: from },
      timestamp: Date.now(),
    };
  }

  private parseWAHAPayload(payload: Record<string, unknown>): IncomingMessage | null {
    const event = payload["event"] as string | undefined;
    if (event !== "message") return null;

    const data = payload["payload"] as Record<string, unknown> | undefined;
    if (!data) return null;

    const from = (data["from"] as string | undefined)?.replace("@c.us", "") ?? "";
    const body = data["body"] as string | undefined;
    if (!from || !body) return null;

    return {
      id: (data["id"] as string | undefined) ?? `waha-${Date.now()}`,
      platform: "whatsapp",
      chatId: from,
      text: body,
      from: { id: from, ...((data["notifyName"] as string | undefined) !== undefined && { name: data["notifyName"] as string }) },
      timestamp: ((data["timestamp"] as number | undefined) ?? Date.now() / 1000) * 1000,
    };
  }
}
