import React, { useState, useEffect, useCallback } from "react";
import type { AgentTask, ChromeMessage, ChromeResponse, ExtensionSettings } from "@/shared/types";

// ─── Styles ───────────────────────────────────────────────────────────────────

const css = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Space+Grotesk:wght@400;500;700&display=swap');

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
    --warning: #fbbf24;
    --safety-on: #f87171;
    --safety-off: #34d399;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Space Grotesk', sans-serif;
    background: var(--bg);
    color: var(--text);
    width: 420px;
  }

  .app {
    display: flex;
    flex-direction: column;
    height: 600px;
  }

  /* Header */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 15px;
    letter-spacing: -0.3px;
  }

  .logo-icon {
    width: 24px;
    height: 24px;
    background: var(--accent);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
  }

  .header-actions {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .icon-btn {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 14px;
    padding: 5px 8px;
    transition: all 0.15s;
  }

  .icon-btn:hover {
    background: var(--accent-dim);
    border-color: var(--accent);
    color: var(--accent);
  }

  /* Safety toggle */
  .safety-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    border-radius: 6px;
    border: 1px solid;
    cursor: pointer;
    font-size: 10px;
    font-family: 'IBM Plex Mono', monospace;
    font-weight: 500;
    padding: 4px 9px;
    transition: all 0.15s;
    letter-spacing: 0.04em;
  }

  .safety-btn.safety-on {
    background: #f8717122;
    border-color: #f87171;
    color: #f87171;
  }

  .safety-btn.safety-off {
    background: #34d39922;
    border-color: #34d399;
    color: #34d399;
  }

  /* Provider bar */
  .provider-bar {
    display: flex;
    gap: 6px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .provider-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 100px;
    color: var(--text-dim);
    cursor: pointer;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    padding: 4px 10px;
    white-space: nowrap;
    transition: all 0.15s;
  }

  .provider-chip.active {
    background: var(--accent-dim);
    border-color: var(--accent);
    color: var(--accent);
  }

  .provider-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }

  /* Input area */
  .input-area {
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
  }

  .input-wrap {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow: hidden;
    transition: border-color 0.15s;
  }

  .input-wrap:focus-within {
    border-color: var(--accent);
  }

  .goal-input {
    background: transparent;
    border: none;
    color: var(--text);
    font-family: 'Space Grotesk', sans-serif;
    font-size: 13px;
    outline: none;
    padding: 10px 12px 4px;
    resize: none;
    width: 100%;
  }

  .goal-input::placeholder {
    color: var(--text-dim);
  }

  .input-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px 8px;
  }

  .char-count {
    color: var(--text-dim);
    font-size: 10px;
    font-family: 'IBM Plex Mono', monospace;
  }

  .run-btn {
    background: var(--accent);
    border: none;
    border-radius: 6px;
    color: white;
    cursor: pointer;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 12px;
    font-weight: 600;
    padding: 5px 14px;
    transition: all 0.15s;
  }

  .run-btn:hover { filter: brightness(1.1); }
  .run-btn:disabled { opacity: 0.4; cursor: default; }

  /* Tasks list */
  .tasks-section {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }

  .tasks-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px 4px;
  }

  .tasks-label {
    color: var(--text-dim);
    font-size: 10px;
    font-family: 'IBM Plex Mono', monospace;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .clear-btn {
    background: transparent;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 10px;
    font-family: 'IBM Plex Mono', monospace;
  }

  .clear-btn:hover { color: var(--error); }

  /* Task card */
  .task-card {
    border-bottom: 1px solid var(--border);
    padding: 10px 16px;
    transition: background 0.1s;
  }

  .task-card:hover { background: var(--surface); }

  .task-header {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 4px;
    cursor: pointer;
  }

  .status-badge {
    border-radius: 4px;
    font-size: 9px;
    font-family: 'IBM Plex Mono', monospace;
    font-weight: 500;
    letter-spacing: 0.05em;
    padding: 2px 6px;
    text-transform: uppercase;
    white-space: nowrap;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .status-thinking  { background: #7c6dfa22; color: #7c6dfa; }
  .status-acting    { background: #fbbf2422; color: #fbbf24; }
  .status-waiting_user { background: #60a5fa22; color: #60a5fa; }
  .status-paused    { background: #f59e0b22; color: #f59e0b; }
  .status-completed { background: #34d39922; color: #34d399; }
  .status-error     { background: #f8717122; color: #f87171; }
  .status-idle      { background: #88889922; color: #888899; }

  .task-goal {
    color: var(--text);
    font-size: 12px;
    line-height: 1.4;
    flex: 1;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .task-meta {
    color: var(--text-dim);
    font-size: 10px;
    font-family: 'IBM Plex Mono', monospace;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }

  /* Task controls row */
  .task-controls {
    display: flex;
    gap: 5px;
    margin-top: 6px;
  }

  .ctrl-btn {
    border-radius: 5px;
    border: 1px solid;
    cursor: pointer;
    font-size: 10px;
    font-family: 'IBM Plex Mono', monospace;
    font-weight: 500;
    padding: 3px 10px;
    transition: all 0.15s;
  }

  .ctrl-btn:hover { filter: brightness(1.2); }

  .ctrl-btn.pause {
    background: #f59e0b22;
    border-color: #f59e0b;
    color: #f59e0b;
  }

  .ctrl-btn.resume {
    background: #34d39922;
    border-color: #34d399;
    color: #34d399;
  }

  .ctrl-btn.cancel {
    background: #f8717122;
    border-color: #f87171;
    color: #f87171;
  }

  /* Log panel */
  .log-panel {
    background: var(--surface2);
    border-radius: 6px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    margin: 6px 0;
    max-height: 180px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }

  .log-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px 4px;
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    background: var(--surface2);
  }

  .log-title {
    color: var(--text-dim);
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .log-count {
    color: var(--accent);
    font-size: 9px;
  }

  .step-row {
    padding: 3px 10px;
    line-height: 1.6;
    display: flex;
    gap: 6px;
    border-bottom: 1px solid #1a1a22;
  }

  .step-row:last-child { border-bottom: none; }

  .step-num {
    color: var(--border);
    min-width: 18px;
    text-align: right;
  }

  .step-type { color: var(--accent); flex-shrink: 0; }
  .step-content {
    flex: 1;
    min-width: 0;
    color: var(--text-dim);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .step-content.has-output { color: var(--text); }
  .step-content.has-error { color: var(--error); }

  .step-dur {
    color: var(--border);
    flex-shrink: 0;
    font-size: 9px;
  }

  /* Approve buttons */
  .approve-btns {
    display: flex;
    gap: 6px;
    margin-top: 6px;
  }

  .approve-btn {
    border-radius: 5px;
    border: 1px solid;
    cursor: pointer;
    font-size: 11px;
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 500;
    padding: 4px 12px;
    transition: all 0.15s;
  }

  .approve-btn.yes {
    background: #34d39920;
    border-color: #34d399;
    color: #34d399;
  }

  .approve-btn.no {
    background: #f8717120;
    border-color: #f87171;
    color: #f87171;
  }

  .approve-btn:hover { filter: brightness(1.2); }

  /* Safety warning */
  .safety-warning {
    background: #f59e0b11;
    border: 1px solid #f59e0b44;
    border-radius: 6px;
    color: #f59e0b;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    margin: 4px 0;
    padding: 6px 10px;
  }

  /* Empty state */
  .empty {
    align-items: center;
    color: var(--text-dim);
    display: flex;
    flex-direction: column;
    gap: 8px;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
  }

  .empty-icon { font-size: 32px; opacity: 0.4; }
  .empty-text { font-size: 12px; line-height: 1.5; }

  /* Footer */
  .footer {
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
  }

  .footer-stats {
    color: var(--text-dim);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
  }

  .settings-link {
    background: transparent;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 11px;
    text-decoration: underline;
    text-decoration-style: dotted;
  }

  .settings-link:hover { color: var(--accent); }

  /* Pulse animation for active tasks */
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .status-thinking .provider-dot,
  .status-acting .provider-dot {
    animation: pulse 1.5s infinite;
  }
`;

// ─── Chrome message helpers ───────────────────────────────────────────────────

async function sendMsg<T>(message: ChromeMessage): Promise<T> {
  const res = (await chrome.runtime.sendMessage(message)) as ChromeResponse<T>;
  if (!res.success) throw new Error(res.error);
  return res.data;
}

// ─── Step type display ────────────────────────────────────────────────────────

function stepLabel(type: string): string {
  switch (type) {
    case "llm_call": return "LLM";
    case "tool_call": return "TOOL";
    case "browser_action": return "BROWSER";
    case "user_message": return "USER";
    case "agent_message": return "AGENT";
    case "observation": return "OBS";
    default: return type.toUpperCase();
  }
}

function stepSummary(step: AgentTask["steps"][number]): string {
  if (step.error) return step.error;
  if (step.output) {
    try {
      const parsed = JSON.parse(step.input) as { tool?: string; args?: Record<string, unknown> };
      if (parsed.tool) return `${parsed.tool} → ${step.output.substring(0, 60)}`;
    } catch { /* ignore */ }
    return step.output.substring(0, 80);
  }
  try {
    const parsed = JSON.parse(step.input) as { tool?: string; messageCount?: number };
    if (parsed.tool) return parsed.tool;
    if (parsed.messageCount !== undefined) return `${parsed.messageCount} messages`;
  } catch { /* ignore */ }
  return step.input.substring(0, 60);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PopupApp(): React.ReactElement {
  const [goal, setGoal] = useState("");
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    Promise.all([
      sendMsg<AgentTask[]>({ type: "GET_TASKS" }),
      sendMsg<ExtensionSettings>({ type: "GET_SETTINGS" }),
    ])
      .then(([t, s]) => {
        setTasks(t);
        setSettings(s);
      })
      .catch(console.error);

    // Listen for task updates from background
    const listener = (message: { type: string; payload: AgentTask }) => {
      if (message.type === "TASK_UPDATED") {
        setTasks((prev) => {
          const idx = prev.findIndex((t) => t.id === message.payload.id);
          if (idx === -1) return [message.payload, ...prev];
          const next = [...prev];
          next[idx] = message.payload;
          return next;
        });
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const handleRun = useCallback(async () => {
    if (!goal.trim()) return;
    setLoading(true);
    try {
      const task = await sendMsg<AgentTask>({
        type: "CREATE_TASK",
        payload: { goal: goal.trim() },
      });
      setTasks((prev) => [task, ...prev]);
      setGoal("");
      setExpandedTask(task.id);
    } catch (err) {
      console.error("Failed to create task:", err);
    } finally {
      setLoading(false);
    }
  }, [goal]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleRun();
  };

  const handleApprove = async (taskId: string, approved: boolean) => {
    await sendMsg({ type: "USER_APPROVAL", payload: { taskId, approved } });
  };

  const handlePause = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    await sendMsg({ type: "PAUSE_TASK", payload: { taskId } });
  };

  const handleResume = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    await sendMsg({ type: "RESUME_TASK", payload: { taskId } });
  };

  const handleCancel = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    await sendMsg({ type: "CANCEL_TASK", payload: { taskId } });
  };

  const toggleSafety = async () => {
    if (!settings) return;
    const updated = {
      ...settings,
      agent: { ...settings.agent, safetyMode: !settings.agent.safetyMode },
    };
    setSettings(updated);
    await sendMsg({ type: "SAVE_SETTINGS", payload: { settings: updated } });
  };

  const activeProvider = settings?.providers.find(
    (p) => p.id === settings.agent.defaultProviderId && p.enabled
  );

  const activeTasks = tasks.filter(
    (t) => t.status !== "completed" && t.status !== "error"
  ).length;

  const safetyMode = settings?.agent.safetyMode ?? true;

  return (
    <>
      <style>{css}</style>
      <div className="app">
        {/* Header */}
        <div className="header">
          <div className="logo">
            <div className="logo-icon">🤖</div>
            BrowserAgent
          </div>
          <div className="header-actions">
            <button
              className={`safety-btn ${safetyMode ? "safety-on" : "safety-off"}`}
              title={safetyMode ? "Safety ON — dangerous tools blocked (click to disable)" : "Safety OFF — all tools allowed (click to enable)"}
              onClick={toggleSafety}
            >
              {safetyMode ? "🛡 SAFE" : "⚠ UNSAFE"}
            </button>
            <button
              className="icon-btn"
              title="Open full UI in side panel"
              onClick={() => {
                chrome.sidePanel?.open({ windowId: undefined as unknown as number }).catch(() => {
                  // Fallback: open as a tab
                  chrome.tabs.create({ url: chrome.runtime.getURL("panel/index.html") });
                });
              }}
            >
              ⬡
            </button>
            <button
              className="icon-btn"
              title="Open full UI as browser tab"
              onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL("panel/index.html") })}
            >
              ↗
            </button>
            <button
              className="icon-btn"
              title="Open Options"
              onClick={() => chrome.runtime.openOptionsPage()}
            >
              ⚙
            </button>
          </div>
        </div>

        {/* Provider selector */}
        <div className="provider-bar">
          {settings?.providers
            .filter((p) => p.enabled)
            .map((p) => (
              <button
                key={p.id}
                className={`provider-chip ${p.id === settings.agent.defaultProviderId ? "active" : ""}`}
                onClick={() => {
                  if (settings) {
                    const updated = {
                      ...settings,
                      agent: { ...settings.agent, defaultProviderId: p.id },
                    };
                    setSettings(updated);
                    sendMsg({ type: "SAVE_SETTINGS", payload: { settings: updated } }).catch(console.error);
                  }
                }}
              >
                <div className="provider-dot" />
                {p.name}
              </button>
            ))}
          {!settings?.providers.some((p) => p.enabled) && (
            <button className="provider-chip" onClick={() => chrome.runtime.openOptionsPage()}>
              ⚠ Configure a provider
            </button>
          )}
        </div>

        {/* Goal input */}
        <div className="input-area">
          <div className="input-wrap">
            <textarea
              className="goal-input"
              rows={2}
              placeholder={`Tell the agent what to do...\n"Summarize my unread emails"`}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="input-footer">
              <span className="char-count">{goal.length} chars · ⌘+Enter to run</span>
              <button
                className="run-btn"
                onClick={handleRun}
                disabled={loading || !goal.trim() || !activeProvider}
              >
                {loading ? "Starting..." : "▶ Run"}
              </button>
            </div>
          </div>
        </div>

        {/* Tasks */}
        <div className="tasks-section">
          {tasks.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">⚡</div>
              <div className="empty-text">
                No tasks yet. Type a goal above and hit Run.<br />
                The agent will control your browser to complete it.
              </div>
            </div>
          ) : (
            <>
              <div className="tasks-header">
                <span className="tasks-label">Tasks ({tasks.length})</span>
              </div>
              {tasks.map((task) => {
                const isExpanded = expandedTask === task.id;
                const isActive = task.status === "thinking" || task.status === "acting";
                const isPaused = task.status === "paused";
                const isWaiting = task.status === "waiting_user";
                const canControl = isActive || isPaused || isWaiting;

                return (
                  <div key={task.id} className="task-card">
                    {/* Clickable header row */}
                    <div
                      className="task-header"
                      onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                    >
                      <span className={`status-badge status-${task.status}`}>
                        {task.status.replace("_", " ")}
                      </span>
                      <span className="task-goal">{task.goal}</span>
                    </div>

                    <div className="task-meta">
                      <span>{task.providerId}</span>
                      <span>·</span>
                      <span>{task.steps.length} steps</span>
                      <span>·</span>
                      <span>{new Date(task.updatedAt).toLocaleTimeString()}</span>
                    </div>

                    {/* Control buttons for active/paused tasks */}
                    {canControl && (
                      <div className="task-controls">
                        {isActive && (
                          <button
                            className="ctrl-btn pause"
                            onClick={(e) => void handlePause(e, task.id)}
                          >
                            ⏸ Pause
                          </button>
                        )}
                        {isPaused && (
                          <button
                            className="ctrl-btn resume"
                            onClick={(e) => void handleResume(e, task.id)}
                          >
                            ▶ Resume
                          </button>
                        )}
                        <button
                          className="ctrl-btn cancel"
                          onClick={(e) => void handleCancel(e, task.id)}
                        >
                          ✕ Cancel
                        </button>
                      </div>
                    )}

                    {/* Expanded section: logs + approve buttons */}
                    {isExpanded && (
                      <>
                        {/* Safety warning if safety mode is off */}
                        {!safetyMode && (isActive || isPaused) && (
                          <div className="safety-warning">
                            ⚠ Safety mode is OFF — agent can fill forms & run scripts
                          </div>
                        )}

                        {/* Log panel */}
                        {task.steps.length > 0 && (
                          <div className="log-panel">
                            <div className="log-header">
                              <span className="log-title">Agent Log</span>
                              <span className="log-count">{task.steps.length} steps</span>
                            </div>
                            {task.steps.map((step, i) => (
                              <div key={step.id} className="step-row">
                                <span className="step-num">{i + 1}</span>
                                <span className="step-type">[{stepLabel(step.type)}]</span>
                                <span
                                  className={`step-content ${step.error ? "has-error" : step.output ? "has-output" : ""}`}
                                  title={step.output ?? step.error ?? step.input}
                                >
                                  {stepSummary(step)}
                                </span>
                                {step.durationMs !== undefined && (
                                  <span className="step-dur">{step.durationMs}ms</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Task result or error */}
                        {task.status === "completed" && task.result && (
                          <div style={{
                            background: "#34d39911",
                            border: "1px solid #34d39933",
                            borderRadius: 6,
                            color: "#34d399",
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontSize: 10,
                            marginTop: 4,
                            padding: "6px 10px",
                          }}>
                            ✓ {task.result.substring(0, 120)}
                          </div>
                        )}
                        {task.status === "error" && task.error && (
                          <div style={{
                            background: "#f8717111",
                            border: "1px solid #f8717133",
                            borderRadius: 6,
                            color: "#f87171",
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontSize: 10,
                            marginTop: 4,
                            padding: "6px 10px",
                          }}>
                            ✗ {task.error}
                          </div>
                        )}

                        {/* Approve/reject for waiting_user */}
                        {isWaiting && (
                          <div className="approve-btns">
                            <button
                              className="approve-btn yes"
                              onClick={(e) => { e.stopPropagation(); void handleApprove(task.id, true); }}
                            >
                              ✓ Approve
                            </button>
                            <button
                              className="approve-btn no"
                              onClick={(e) => { e.stopPropagation(); void handleApprove(task.id, false); }}
                            >
                              ✕ Cancel
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="footer">
          <span className="footer-stats">
            {activeTasks > 0 ? `${activeTasks} active` : "idle"} ·{" "}
            {tasks.filter((t) => t.status === "completed").length} done ·{" "}
            {safetyMode ? "🛡 safe" : "⚠ unsafe"}
          </span>
          <button className="settings-link" onClick={() => chrome.runtime.openOptionsPage()}>
            Settings
          </button>
        </div>
      </div>
    </>
  );
}
