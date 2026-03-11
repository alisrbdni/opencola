# 🤖 OpenCola BrowserAgent

A production-grade Chrome Extension that runs autonomous AI agents to control your browser and communicate with you proactively via **Telegram** and **WhatsApp**.

```
┌─────────────────────────────────────────────────────────┐
│  You (Telegram/WhatsApp)  ←→  BrowserAgent  ←→  Chrome  │
│                                    ↑                     │
│              OpenAI / Anthropic / Gemini / Groq / Ollama │
└─────────────────────────────────────────────────────────┘
```

---

## ✨ Features

- **Multi-LLM**: OpenAI (GPT-4o, o1), Anthropic (Claude Sonnet/Opus/Haiku), Google Gemini, Groq (Llama/Mixtral), Ollama (local models)
- **Full browser control**: navigate, click, type, fill forms, scroll, extract text, run JS, take screenshots
- **Messaging integrations**: Telegram bot polling + WhatsApp (Twilio or self-hosted WAHA)
- **ReAct agent loop**: think → act → observe → repeat with full tool call support
- **Vision support**: sends page screenshots to vision-capable LLMs for visual reasoning
- **Proactive communication**: agent messages you when it needs input or completes a task
- **Autonomy levels**: supervised, semi-auto, or fully autonomous
- **Persistent tasks**: tasks survive service worker restarts
- **Popup UI**: real-time task status with step-by-step log
- **Options page**: configure all providers and integrations without touching code

---

## 📁 Project Structure

```
browser-agent/
├── manifest.json                    # Chrome MV3 manifest
├── webpack.config.js
├── tsconfig.json
├── package.json
└── src/
    ├── shared/
    │   └── types.ts                 # All TypeScript types
    │
    ├── llm/
    │   ├── provider-registry.ts     # ILLMProvider interface + registry
    │   └── providers/
    │       ├── openai.ts            # OpenAI GPT-4o, o1
    │       ├── anthropic.ts         # Claude Opus/Sonnet/Haiku
    │       ├── gemini.ts            # Google Gemini
    │       └── groq-ollama.ts       # Groq + Ollama (local)
    │
    ├── browser/
    │   └── controller.ts           # All browser actions via scripting API
    │
    ├── messaging/
    │   ├── telegram.ts             # Telegram bot client (long polling)
    │   ├── whatsapp.ts             # WhatsApp (Twilio / WAHA)
    │   └── router.ts               # Routes messages → agent
    │
    ├── background/
    │   ├── index.ts                # Service worker entry point
    │   ├── agent-orchestrator.ts   # ReAct loop, task management
    │   └── settings-store.ts       # chrome.storage.sync wrapper
    │
    ├── content/
    │   └── index.ts                # Content script (page interaction)
    │
    ├── popup/
    │   ├── index.html
    │   ├── index.tsx
    │   └── App.tsx                 # Popup React UI
    │
    └── options/
        ├── index.html
        ├── index.tsx
        └── App.tsx                 # Full settings page
```

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Build

```bash
npm run build          # Production build
npm run dev            # Dev build with watch
```

### 3. Load in Chrome

1. Navigate to `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked**
4. Select the `dist/` folder

### 4. Configure

Click the extension icon → ⚙ Settings, then:

1. **Add LLM providers**: paste API keys for OpenAI, Anthropic, Gemini, or Groq
2. **Set default provider** and model
3. **Enable Telegram**: paste your bot token from [@BotFather](https://t.me/BotFather), add your chat ID to the allowlist
4. **Enable WhatsApp**: choose Twilio or self-hosted WAHA and fill in credentials
5. Click **Save**

---

## 🤖 Adding a Custom LLM Provider

Implement the `ILLMProvider` interface and register it:

```typescript
import { ILLMProvider } from "@/llm/provider-registry";
import { LLMRequest, LLMResponse } from "@/shared/types";

class MyProvider implements ILLMProvider {
  readonly id = "my-provider" as const;
  readonly name = "My Provider";

  async testConnection(): Promise<boolean> {
    return true;
  }

  async complete(request: LLMRequest, modelId: string): Promise<LLMResponse> {
    // Call your API here
    return {
      content: "...",
      usage: { promptTokens: 0, completionTokens: 0 },
      model: modelId,
      provider: "openai", // closest match
    };
  }
}

// In background/index.ts:
LLMProviderRegistry.register(new MyProvider());
```

---

## 📬 Telegram Setup

1. Message [@BotFather](https://t.me/BotFather) → `/newbot`
2. Copy the **bot token** → paste in Options → Telegram
3. Message [@userinfobot](https://t.me/userinfobot) to get your **chat ID**
4. Add your chat ID to the allowlist

Your bot will now poll for messages every 3 seconds. Send it any natural language task:

```
Book me a flight from NYC to London for next Monday, economy class
```

The agent will take over your browser, complete the task, and message you back with updates.

---

## 📱 WhatsApp Setup

### Option A — Twilio (cloud)
1. Create a [Twilio](https://twilio.com) account
2. Activate the **WhatsApp Sandbox** or get a business number
3. Fill in Account SID, Auth Token, and phone number in Options
4. Set your Twilio webhook URL to: `chrome-extension://<YOUR_EXT_ID>/whatsapp-webhook`
   *(Note: for production, you'd need a public-facing server to receive webhooks)*

### Option B — WAHA (self-hosted, no restrictions)
1. Run [WAHA](https://waha.devlike.pro/) locally: `docker run -p 3000:3000 devlikeapro/whatsapp-http-api`
2. Scan the QR code to connect your WhatsApp
3. Set WAHA URL to `http://localhost:3000` in Options
4. Configure WAHA webhooks to point to your background script handler

---

## 🛠 Browser Tools Available to the Agent

| Tool | Description |
|------|-------------|
| `navigate` | Go to a URL |
| `click` | Click a CSS-selected element |
| `type` | Type into an input field |
| `scroll` | Scroll the page up/down |
| `screenshot` | Capture the visible page |
| `extract_text` | Get visible page text |
| `evaluate_js` | Run arbitrary JS |
| `fill_form` | Fill multiple fields at once |
| `select_option` | Choose a `<select>` option |
| `wait` | Pause for N milliseconds |
| `new_tab` | Open a new tab |
| `hover` | Hover over an element |
| `send_message` | Send a message to the user |
| `task_complete` | Signal task completion |

---

## 🔒 Security

- API keys are stored in `chrome.storage.sync` (encrypted by Chrome, synced across devices)
- Telegram allowlist enforced server-side — unauthorized chat IDs receive a rejection message
- WhatsApp allowlist checked before dispatch
- The agent asks before submitting forms or making purchases when autonomy level is `supervised`
- Content Security Policy defined in manifest to prevent code injection

---

## 🔧 Development Tips

```bash
# Type check only
npm run type-check

# Lint
npm run lint

# Clean and rebuild
npm run clean && npm run build
```

### Debugging the Service Worker

1. Go to `chrome://extensions`
2. Click "Service Worker" link next to the extension
3. DevTools opens for the background context

### Debugging Content Scripts

Open DevTools on any page and look for `[BrowserAgent]` log entries.

---

## 📝 Task Examples

```
# Research
"Search Google for the top 5 AI startups in 2025 and summarize their products"

# Shopping  
"Find the cheapest iPhone 16 Pro on Amazon and send me the link"

# Productivity
"Open Gmail and summarize my 5 most recent unread emails"

# Web automation
"Go to my company's Jira board and create a ticket titled 'Fix login bug' in the Backlog"

# Social media
"Post on Twitter/X: 'Just shipped a new feature! 🚀' and tag @anthropic"

# Data extraction
"Go to HackerNews front page and list the top 10 headlines with their URLs"
```

---

## License

MIT
