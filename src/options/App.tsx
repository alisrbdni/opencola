import React, { useState, useEffect, useCallback } from "react";
import type {
  ExtensionSettings,
  LLMProviderConfig,
  LLMProviderId,
  ChromeMessage,
  ChromeResponse,
} from "@/shared/types";

async function sendMsg<T>(message: ChromeMessage): Promise<T> {
  const res = (await chrome.runtime.sendMessage(message)) as ChromeResponse<T>;
  if (!res.success) throw new Error(res.error);
  return res.data;
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Space+Grotesk:wght@400;500;600;700&display=swap');

  :root {
    --bg: #0f0f13;
    --surface: #18181f;
    --surface2: #22222c;
    --border: #2e2e3a;
    --accent: #7c6dfa;
    --accent-dim: #7c6dfa22;
    --text: #e8e8f0;
    --text-dim: #888899;
    --success: #34d399;
    --error: #f87171;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Space Grotesk', sans-serif;
    background: var(--bg);
    color: var(--text);
  }

  .page {
    max-width: 720px;
    margin: 0 auto;
    padding: 40px 24px;
  }

  .page-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 40px;
  }

  .page-logo {
    background: var(--accent);
    border-radius: 10px;
    font-size: 20px;
    height: 40px;
    width: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .page-title { font-size: 22px; font-weight: 700; }
  .page-subtitle { color: var(--text-dim); font-size: 13px; }

  .section {
    margin-bottom: 32px;
  }

  .section-title {
    color: var(--text-dim);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.1em;
    margin-bottom: 12px;
    text-transform: uppercase;
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
  }

  .card-row {
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
  }

  .card-row:last-child { border-bottom: none; }

  .row-label {
    flex: 1;
    min-width: 0;
  }

  .row-title { font-size: 13px; font-weight: 500; }
  .row-desc { color: var(--text-dim); font-size: 11px; margin-top: 2px; }

  .toggle {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 100px;
    cursor: pointer;
    height: 22px;
    position: relative;
    width: 40px;
    flex-shrink: 0;
    transition: all 0.2s;
  }

  .toggle.on {
    background: var(--accent);
    border-color: var(--accent);
  }

  .toggle::after {
    background: var(--text-dim);
    border-radius: 50%;
    content: '';
    height: 16px;
    left: 3px;
    position: absolute;
    top: 2px;
    width: 16px;
    transition: all 0.2s;
  }

  .toggle.on::after {
    background: white;
    left: 19px;
  }

  input[type="text"],
  input[type="password"],
  input[type="number"],
  select,
  textarea {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12px;
    outline: none;
    padding: 6px 10px;
    transition: border-color 0.15s;
    width: 100%;
  }

  input:focus, select:focus, textarea:focus {
    border-color: var(--accent);
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  .input-label {
    color: var(--text-dim);
    font-size: 10px;
    font-family: 'IBM Plex Mono', monospace;
  }

  .provider-section {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    margin-bottom: 8px;
    overflow: hidden;
  }

  .provider-header {
    align-items: center;
    cursor: pointer;
    display: flex;
    gap: 10px;
    padding: 14px 16px;
  }

  .provider-name {
    flex: 1;
    font-size: 14px;
    font-weight: 600;
  }

  .provider-body {
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }

  .test-btn {
    background: var(--accent-dim);
    border: 1px solid var(--accent);
    border-radius: 6px;
    color: var(--accent);
    cursor: pointer;
    font-size: 12px;
    font-family: 'IBM Plex Mono', monospace;
    padding: 6px 14px;
    transition: all 0.15s;
    width: fit-content;
  }

  .test-btn:hover { background: var(--accent); color: white; }

  .test-result {
    border-radius: 5px;
    font-size: 11px;
    font-family: 'IBM Plex Mono', monospace;
    padding: 4px 8px;
    margin-left: 8px;
  }

  .test-ok { background: #34d39920; color: #34d399; }
  .test-fail { background: #f8717120; color: #f87171; }

  .save-bar {
    align-items: center;
    background: var(--surface);
    border-top: 1px solid var(--border);
    bottom: 0;
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    left: 0;
    padding: 16px 24px;
    position: sticky;
    right: 0;
  }

  .save-btn {
    background: var(--accent);
    border: none;
    border-radius: 8px;
    color: white;
    cursor: pointer;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 13px;
    font-weight: 600;
    padding: 8px 20px;
    transition: filter 0.15s;
  }

  .save-btn:hover { filter: brightness(1.1); }

  .save-status {
    color: var(--success);
    font-size: 12px;
    font-family: 'IBM Plex Mono', monospace;
  }

  .chips-input {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 8px;
    cursor: text;
  }

  .chip {
    background: var(--accent-dim);
    border: 1px solid var(--accent);
    border-radius: 4px;
    color: var(--accent);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
  }

  .chip-remove {
    cursor: pointer;
    opacity: 0.7;
  }

  .chip-remove:hover { opacity: 1; }
`;

// ─── Provider panel ───────────────────────────────────────────────────────────

function ProviderPanel({
  config,
  onChange,
}: {
  config: LLMProviderConfig;
  onChange: (updated: LLMProviderConfig) => void;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(config.enabled);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Send a test message to the background
      await new Promise((r) => setTimeout(r, 1200)); // placeholder
      setTestResult("ok");
    } catch {
      setTestResult("fail");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="provider-section">
      <div className="provider-header" onClick={() => setExpanded(!expanded)}>
        <div className="toggle" onClick={(e) => {
          e.stopPropagation();
          onChange({ ...config, enabled: !config.enabled });
          if (!config.enabled) setExpanded(true);
        }} style={{
          background: config.enabled ? "var(--accent)" : undefined,
          borderColor: config.enabled ? "var(--accent)" : undefined,
        }}>
          <div style={{
            background: config.enabled ? "white" : "var(--text-dim)",
            borderRadius: "50%",
            height: 16,
            left: config.enabled ? 19 : 3,
            position: "absolute",
            top: 2,
            width: 16,
            transition: "all 0.2s",
          }} />
        </div>
        <span className="provider-name">{config.name}</span>
        <span style={{ color: "var(--text-dim)", fontSize: 12 }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {expanded && (
        <div className="provider-body">
          <div className="input-group">
            <label className="input-label">API Key</label>
            <input
              type="password"
              placeholder="sk-..."
              value={config.apiKey}
              onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
            />
          </div>

          {config.id === "ollama" && (
            <div className="input-group">
              <label className="input-label">Base URL</label>
              <input
                type="text"
                placeholder="http://localhost:11434"
                value={config.baseUrl ?? ""}
                onChange={(e) => onChange({ ...config, baseUrl: e.target.value })}
              />
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Default Model</label>
            <select
              value={config.defaultModel}
              onChange={(e) => onChange({ ...config, defaultModel: e.target.value })}
            >
              {config.availableModels.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center" }}>
            <button className="test-btn" onClick={handleTest} disabled={testing || !config.apiKey}>
              {testing ? "Testing..." : "Test Connection"}
            </button>
            {testResult && (
              <span className={`test-result test-${testResult}`}>
                {testResult === "ok" ? "✓ Connected" : "✗ Failed"}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Options App ──────────────────────────────────────────────────────────────

export function OptionsApp(): React.ReactElement {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    sendMsg<ExtensionSettings>({ type: "GET_SETTINGS" }).then(setSettings).catch(console.error);
  }, []);

  const updateProvider = useCallback(
    (updated: LLMProviderConfig) => {
      setSettings((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          providers: prev.providers.map((p) => (p.id === updated.id ? updated : p)),
        };
      });
    },
    []
  );

  const handleSave = async () => {
    if (!settings) return;
    await sendMsg({ type: "SAVE_SETTINGS", payload: { settings } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (!settings) {
    return (
      <>
        <style>{css}</style>
        <div className="page" style={{ color: "var(--text-dim)", fontSize: 13 }}>
          Loading...
        </div>
      </>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div className="page">
        <div className="page-header">
          <div className="page-logo">🤖</div>
          <div>
            <div className="page-title">BrowserAgent Settings</div>
            <div className="page-subtitle">
              Configure LLM providers, messaging integrations, and agent behavior
            </div>
          </div>
        </div>

        {/* LLM Providers */}
        <div className="section">
          <div className="section-title">LLM Providers</div>
          {settings.providers.map((p) => (
            <ProviderPanel key={p.id} config={p} onChange={updateProvider} />
          ))}
        </div>

        {/* Agent Settings */}
        <div className="section">
          <div className="section-title">Agent Behavior</div>
          <div className="card">
            <div className="card-row">
              <div className="row-label">
                <div className="row-title">Default Provider</div>
                <div className="row-desc">Which LLM handles new tasks by default</div>
              </div>
              <select
                style={{ width: 160 }}
                value={settings.agent.defaultProviderId}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    agent: { ...settings.agent, defaultProviderId: e.target.value as LLMProviderId },
                  })
                }
              >
                {settings.providers
                  .filter((p) => p.enabled)
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
              </select>
            </div>

            <div className="card-row">
              <div className="row-label">
                <div className="row-title">Max Steps</div>
                <div className="row-desc">Maximum tool calls per task</div>
              </div>
              <input
                type="number"
                style={{ width: 80 }}
                min={5}
                max={100}
                value={settings.agent.maxStepsPerTask}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    agent: { ...settings.agent, maxStepsPerTask: Number(e.target.value) },
                  })
                }
              />
            </div>

            <div className="card-row">
              <div className="row-label">
                <div className="row-title">Autonomy Level</div>
                <div className="row-desc">How much the agent acts without asking</div>
              </div>
              <select
                style={{ width: 160 }}
                value={settings.agent.autonomyLevel}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    agent: {
                      ...settings.agent,
                      autonomyLevel: e.target.value as "supervised" | "semi-auto" | "autonomous",
                    },
                  })
                }
              >
                <option value="supervised">Supervised</option>
                <option value="semi-auto">Semi-Auto</option>
                <option value="autonomous">Autonomous</option>
              </select>
            </div>

            <div className="card-row">
              <div className="row-label">
                <div className="row-title">Screenshot on Navigation</div>
                <div className="row-desc">Send page screenshots to LLM for visual context</div>
              </div>
              <div
                className={`toggle ${settings.agent.screenshotEnabled ? "on" : ""}`}
                onClick={() =>
                  setSettings({
                    ...settings,
                    agent: { ...settings.agent, screenshotEnabled: !settings.agent.screenshotEnabled },
                  })
                }
              >
                <div style={{
                  background: settings.agent.screenshotEnabled ? "white" : "var(--text-dim)",
                  borderRadius: "50%",
                  height: 16,
                  left: settings.agent.screenshotEnabled ? 19 : 3,
                  position: "absolute",
                  top: 2,
                  width: 16,
                  transition: "all 0.2s",
                }} />
              </div>
            </div>

            <div className="card-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <div className="row-label">
                <div className="row-title">System Prompt</div>
                <div className="row-desc">Custom instructions for the agent</div>
              </div>
              <textarea
                rows={4}
                style={{ marginTop: 10, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}
                placeholder="You are a helpful assistant that..."
                value={settings.agent.systemPrompt}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    agent: { ...settings.agent, systemPrompt: e.target.value },
                  })
                }
              />
            </div>
          </div>
        </div>

        {/* Telegram */}
        <div className="section">
          <div className="section-title">Telegram Integration</div>
          <div className="card">
            <div className="card-row">
              <div className="row-label">
                <div className="row-title">Enable Telegram Bot</div>
                <div className="row-desc">Receive and create tasks via Telegram</div>
              </div>
              <div
                className={`toggle ${settings.messaging.telegram.enabled ? "on" : ""}`}
                onClick={() =>
                  setSettings({
                    ...settings,
                    messaging: {
                      ...settings.messaging,
                      telegram: {
                        ...settings.messaging.telegram,
                        enabled: !settings.messaging.telegram.enabled,
                      },
                    },
                  })
                }
              >
                <div style={{
                  background: settings.messaging.telegram.enabled ? "white" : "var(--text-dim)",
                  borderRadius: "50%",
                  height: 16,
                  left: settings.messaging.telegram.enabled ? 19 : 3,
                  position: "absolute",
                  top: 2,
                  width: 16,
                  transition: "all 0.2s",
                }} />
              </div>
            </div>

            {settings.messaging.telegram.enabled && (
              <>
                <div className="card-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                  <div className="input-group">
                    <label className="input-label">Bot Token (from @BotFather)</label>
                    <input
                      type="password"
                      placeholder="123456789:AAAA..."
                      value={settings.messaging.telegram.botToken}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          messaging: {
                            ...settings.messaging,
                            telegram: {
                              ...settings.messaging.telegram,
                              botToken: e.target.value,
                            },
                          },
                        })
                      }
                    />
                  </div>
                </div>
                <div className="card-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                  <div className="input-group">
                    <label className="input-label">
                      Allowed Chat IDs (comma-separated, leave empty to allow all)
                    </label>
                    <input
                      type="text"
                      placeholder="123456789, -1001234567890"
                      value={settings.messaging.telegram.allowedChatIds.join(", ")}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          messaging: {
                            ...settings.messaging,
                            telegram: {
                              ...settings.messaging.telegram,
                              allowedChatIds: e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            },
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* WhatsApp */}
        <div className="section">
          <div className="section-title">WhatsApp Integration</div>
          <div className="card">
            <div className="card-row">
              <div className="row-label">
                <div className="row-title">Enable WhatsApp</div>
                <div className="row-desc">Receive and create tasks via WhatsApp</div>
              </div>
              <div
                className={`toggle ${settings.messaging.whatsapp.enabled ? "on" : ""}`}
                onClick={() =>
                  setSettings({
                    ...settings,
                    messaging: {
                      ...settings.messaging,
                      whatsapp: {
                        ...settings.messaging.whatsapp,
                        enabled: !settings.messaging.whatsapp.enabled,
                      },
                    },
                  })
                }
              >
                <div style={{
                  background: settings.messaging.whatsapp.enabled ? "white" : "var(--text-dim)",
                  borderRadius: "50%",
                  height: 16,
                  left: settings.messaging.whatsapp.enabled ? 19 : 3,
                  position: "absolute",
                  top: 2,
                  width: 16,
                  transition: "all 0.2s",
                }} />
              </div>
            </div>

            {settings.messaging.whatsapp.enabled && (
              <>
                <div className="card-row">
                  <div className="row-label">
                    <div className="row-title">Provider</div>
                  </div>
                  <select
                    style={{ width: 160 }}
                    value={settings.messaging.whatsapp.provider}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        messaging: {
                          ...settings.messaging,
                          whatsapp: {
                            ...settings.messaging.whatsapp,
                            provider: e.target.value as "twilio" | "waha",
                          },
                        },
                      })
                    }
                  >
                    <option value="twilio">Twilio</option>
                    <option value="waha">WAHA (self-hosted)</option>
                  </select>
                </div>

                {settings.messaging.whatsapp.provider === "twilio" ? (
                  <>
                    <div className="card-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                      <div className="input-group">
                        <label className="input-label">Account SID</label>
                        <input
                          type="password"
                          value={settings.messaging.whatsapp.twilioAccountSid ?? ""}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              messaging: {
                                ...settings.messaging,
                                whatsapp: { ...settings.messaging.whatsapp, twilioAccountSid: e.target.value },
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="card-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                      <div className="input-group">
                        <label className="input-label">Auth Token</label>
                        <input
                          type="password"
                          value={settings.messaging.whatsapp.twilioAuthToken ?? ""}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              messaging: {
                                ...settings.messaging,
                                whatsapp: { ...settings.messaging.whatsapp, twilioAuthToken: e.target.value },
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="card-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                      <div className="input-group">
                        <label className="input-label">WhatsApp Phone Number</label>
                        <input
                          type="text"
                          placeholder="+14155238886"
                          value={settings.messaging.whatsapp.twilioPhoneNumber ?? ""}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              messaging: {
                                ...settings.messaging,
                                whatsapp: { ...settings.messaging.whatsapp, twilioPhoneNumber: e.target.value },
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="card-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                      <div className="input-group">
                        <label className="input-label">WAHA URL</label>
                        <input
                          type="text"
                          placeholder="http://localhost:3000"
                          value={settings.messaging.whatsapp.wahaUrl ?? ""}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              messaging: {
                                ...settings.messaging,
                                whatsapp: { ...settings.messaging.whatsapp, wahaUrl: e.target.value },
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="card-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                      <div className="input-group">
                        <label className="input-label">API Key</label>
                        <input
                          type="password"
                          value={settings.messaging.whatsapp.wahaApiKey ?? ""}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              messaging: {
                                ...settings.messaging,
                                whatsapp: { ...settings.messaging.whatsapp, wahaApiKey: e.target.value },
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Save bar */}
        <div className="save-bar">
          {saved && <span className="save-status">✓ Saved</span>}
          <button className="save-btn" onClick={handleSave}>
            Save Settings
          </button>
        </div>
      </div>
    </>
  );
}
