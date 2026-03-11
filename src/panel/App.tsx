import React, { useState, useEffect, useCallback } from "react";
import type { AgentTask, ChromeMessage, ChromeResponse, ExtensionSettings } from "@/shared/types";

// ─── Chrome message helpers ───────────────────────────────────────────────────

async function sendMsg<T>(message: ChromeMessage): Promise<T> {
  const res = (await chrome.runtime.sendMessage(message)) as ChromeResponse<T>;
  if (!res.success) throw new Error(res.error);
  return res.data;
}

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
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Space Grotesk', sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
  }

  .panel {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  /* Top bar */
  .topbar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 20px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    flex-shrink: 0;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 16px;
  }

  .logo-icon {
    width: 28px;
    height: 28px;
    background: var(--accent);
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
  }

  .topbar-input {
    flex: 1;
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .goal-input {
    flex: 1;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-family: 'Space Grotesk', sans-serif;
    font-size: 13px;
    outline: none;
    padding: 8px 14px;
    transition: border-color 0.15s;
  }

  .goal-input:focus { border-color: var(--accent); }
  .goal-input::placeholder { color: var(--text-dim); }

  .run-btn {
    background: var(--accent);
    border: none;
    border-radius: 7px;
    color: white;
    cursor: pointer;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 13px;
    font-weight: 600;
    padding: 8px 18px;
    white-space: nowrap;
    transition: filter 0.15s;
  }

  .run-btn:hover { filter: brightness(1.1); }
  .run-btn:disabled { opacity: 0.4; cursor: default; }

  .topbar-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .safety-btn {
    border-radius: 6px;
    border: 1px solid;
    cursor: pointer;
    font-size: 11px;
    font-family: 'IBM Plex Mono', monospace;
    font-weight: 500;
    padding: 5px 10px;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .safety-btn.safety-on { background: #f8717122; border-color: #f87171; color: #f87171; }
  .safety-btn.safety-off { background: #34d39922; border-color: #34d399; color: #34d399; }

  .icon-btn {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 14px;
    padding: 6px 10px;
    transition: all 0.15s;
  }

  .icon-btn:hover { background: var(--accent-dim); border-color: var(--accent); color: var(--accent); }

  /* Provider chips */
  .provider-bar {
    display: flex;
    gap: 6px;
    padding: 8px 20px;
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
    scrollbar-width: none;
    flex-shrink: 0;
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
    padding: 4px 12px;
    white-space: nowrap;
    transition: all 0.15s;
  }

  .provider-chip.active { background: var(--accent-dim); border-color: var(--accent); color: var(--accent); }

  .provider-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }

  /* Main content */
  .main {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* Task list sidebar */
  .sidebar {
    width: 320px;
    flex-shrink: 0;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
  }

  .sidebar-label {
    color: var(--text-dim);
    font-size: 10px;
    font-family: 'IBM Plex Mono', monospace;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .task-list {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }

  .task-item {
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    padding: 10px 16px;
    transition: background 0.1s;
  }

  .task-item:hover { background: var(--surface); }
  .task-item.selected { background: var(--accent-dim); border-left: 2px solid var(--accent); }

  .task-item-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .status-badge {
    border-radius: 4px;
    font-size: 8px;
    font-family: 'IBM Plex Mono', monospace;
    font-weight: 500;
    letter-spacing: 0.05em;
    padding: 2px 5px;
    text-transform: uppercase;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .status-thinking  { background: #7c6dfa22; color: #7c6dfa; }
  .status-acting    { background: #fbbf2422; color: #fbbf24; }
  .status-waiting_user { background: #60a5fa22; color: #60a5fa; }
  .status-paused    { background: #f59e0b22; color: #f59e0b; }
  .status-completed { background: #34d39922; color: #34d399; }
  .status-error     { background: #f8717122; color: #f87171; }
  .status-idle      { background: #88889922; color: #888899; }

  .task-item-goal {
    font-size: 12px;
    line-height: 1.4;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    color: var(--text);
  }

  .task-item-meta {
    color: var(--text-dim);
    font-size: 9px;
    font-family: 'IBM Plex Mono', monospace;
    margin-top: 3px;
  }

  /* Detail pane */
  .detail {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .detail-header {
    padding: 16px 24px 12px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .detail-goal {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
    margin-bottom: 8px;
  }

  .detail-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .detail-controls {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }

  .ctrl-btn {
    border-radius: 6px;
    border: 1px solid;
    cursor: pointer;
    font-size: 11px;
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 600;
    padding: 5px 14px;
    transition: all 0.15s;
  }

  .ctrl-btn:hover { filter: brightness(1.2); }
  .ctrl-btn.pause  { background: #f59e0b22; border-color: #f59e0b; color: #f59e0b; }
  .ctrl-btn.resume { background: #34d39922; border-color: #34d399; color: #34d399; }
  .ctrl-btn.cancel { background: #f8717122; border-color: #f87171; color: #f87171; }
  .ctrl-btn.approve { background: #34d39922; border-color: #34d399; color: #34d399; }

  /* Log pane */
  .log-pane {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
    padding: 0;
  }

  .log-section-title {
    color: var(--text-dim);
    font-size: 9px;
    font-family: 'IBM Plex Mono', monospace;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 10px 24px 6px;
    position: sticky;
    top: 0;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
  }

  .step-row {
    display: flex;
    gap: 10px;
    align-items: baseline;
    padding: 5px 24px;
    border-bottom: 1px solid #1a1a22;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
  }

  .step-row:hover { background: var(--surface); }

  .step-num {
    color: var(--border);
    min-width: 24px;
    text-align: right;
    flex-shrink: 0;
    font-size: 10px;
  }

  .step-type { color: var(--accent); flex-shrink: 0; min-width: 60px; }

  .step-content {
    flex: 1;
    min-width: 0;
    color: var(--text-dim);
    word-break: break-word;
    white-space: pre-wrap;
    line-height: 1.5;
  }

  .step-content.has-output { color: var(--text); }
  .step-content.has-error { color: var(--error); }

  .step-dur {
    color: var(--border);
    flex-shrink: 0;
    font-size: 9px;
    min-width: 50px;
    text-align: right;
  }

  .step-time {
    color: var(--border);
    flex-shrink: 0;
    font-size: 9px;
    min-width: 70px;
    text-align: right;
  }

  /* Result / error banners */
  .result-banner {
    margin: 12px 24px;
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 13px;
    line-height: 1.5;
  }

  .result-banner.success {
    background: #34d39915;
    border: 1px solid #34d39933;
    color: #34d399;
  }

  .result-banner.error {
    background: #f8717115;
    border: 1px solid #f8717133;
    color: #f87171;
  }

  /* Safety warning */
  .safety-warning {
    margin: 8px 24px;
    background: #f59e0b11;
    border: 1px solid #f59e0b33;
    border-radius: 6px;
    color: #f59e0b;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    padding: 8px 12px;
  }

  /* Empty detail pane */
  .detail-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--text-dim);
  }

  .detail-empty-icon { font-size: 40px; opacity: 0.3; }
  .detail-empty-text { font-size: 13px; }

  /* Empty task list */
  .list-empty {
    padding: 40px 16px;
    text-align: center;
    color: var(--text-dim);
    font-size: 12px;
  }

  /* Footer stats */
  .statusbar {
    border-top: 1px solid var(--border);
    padding: 6px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .statusbar-text {
    color: var(--text-dim);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
      const p = JSON.parse(step.input) as { tool?: string };
      if (p.tool) return `${p.tool} → ${step.output.substring(0, 200)}`;
    } catch { /* ignore */ }
    return step.output.substring(0, 200);
  }
  try {
    const p = JSON.parse(step.input) as { tool?: string; messageCount?: number };
    if (p.tool) return p.tool;
    if (p.messageCount !== undefined) return `${p.messageCount} messages in context`;
  } catch { /* ignore */ }
  return step.input.substring(0, 200);
}

// ─── Panel App ────────────────────────────────────────────────────────────────

export function PanelApp(): React.ReactElement {
  const [goal, setGoal] = useState("");
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      sendMsg<AgentTask[]>({ type: "GET_TASKS" }),
      sendMsg<ExtensionSettings>({ type: "GET_SETTINGS" }),
    ])
      .then(([t, s]) => {
        setTasks(t);
        setSettings(s);
        if (t.length > 0) setSelectedId(t[0]!.id);
      })
      .catch(console.error);

    const listener = (msg: { type: string; payload: AgentTask }) => {
      if (msg.type === "TASK_UPDATED") {
        setTasks((prev) => {
          const idx = prev.findIndex((t) => t.id === msg.payload.id);
          if (idx === -1) return [msg.payload, ...prev];
          const next = [...prev];
          next[idx] = msg.payload;
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
      setSelectedId(task.id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [goal]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleRun();
  };

  const handlePause = async (taskId: string) => {
    await sendMsg({ type: "PAUSE_TASK", payload: { taskId } });
  };

  const handleResume = async (taskId: string) => {
    await sendMsg({ type: "RESUME_TASK", payload: { taskId } });
  };

  const handleCancel = async (taskId: string) => {
    await sendMsg({ type: "CANCEL_TASK", payload: { taskId } });
  };

  const handleApprove = async (taskId: string, approved: boolean) => {
    await sendMsg({ type: "USER_APPROVAL", payload: { taskId, approved } });
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

  const selectedTask = tasks.find((t) => t.id === selectedId) ?? null;
  const activeProvider = settings?.providers.find(
    (p) => p.id === settings.agent.defaultProviderId && p.enabled
  );
  const safetyMode = settings?.agent.safetyMode ?? true;
  const activeTasks = tasks.filter((t) => t.status !== "completed" && t.status !== "error").length;

  return (
    <>
      <style>{css}</style>
      <div className="panel">
        {/* Top bar */}
        <div className="topbar">
          <div className="logo">
            <div className="logo-icon">🤖</div>
            BrowserAgent
          </div>
          <div className="topbar-input">
            <input
              className="goal-input"
              type="text"
              placeholder="Describe a task… ⌘+Enter to run"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={handleKey}
            />
            <button
              className="run-btn"
              onClick={handleRun}
              disabled={loading || !goal.trim() || !activeProvider}
            >
              {loading ? "Starting…" : "▶ Run"}
            </button>
          </div>
          <div className="topbar-actions">
            <button
              className={`safety-btn ${safetyMode ? "safety-on" : "safety-off"}`}
              title={safetyMode ? "Safety ON — click to disable" : "Safety OFF — click to enable"}
              onClick={toggleSafety}
            >
              {safetyMode ? "🛡 Safe" : "⚠ Unsafe"}
            </button>
            <button
              className="icon-btn"
              title="Settings"
              onClick={() => chrome.runtime.openOptionsPage()}
            >
              ⚙
            </button>
          </div>
        </div>

        {/* Provider selector */}
        <div className="provider-bar">
          {settings?.providers.filter((p) => p.enabled).map((p) => (
            <button
              key={p.id}
              className={`provider-chip ${p.id === settings.agent.defaultProviderId ? "active" : ""}`}
              onClick={() => {
                if (!settings) return;
                const updated = { ...settings, agent: { ...settings.agent, defaultProviderId: p.id } };
                setSettings(updated);
                sendMsg({ type: "SAVE_SETTINGS", payload: { settings: updated } }).catch(console.error);
              }}
            >
              <div className="provider-dot" />
              {p.name}
            </button>
          ))}
          {!settings?.providers.some((p) => p.enabled) && (
            <button className="provider-chip" onClick={() => chrome.runtime.openOptionsPage()}>
              ⚠ Configure a provider in Settings
            </button>
          )}
        </div>

        {/* Main two-column layout */}
        <div className="main">
          {/* Sidebar: task list */}
          <div className="sidebar">
            <div className="sidebar-header">
              <span className="sidebar-label">Tasks ({tasks.length})</span>
            </div>
            <div className="task-list">
              {tasks.length === 0 ? (
                <div className="list-empty">No tasks yet.<br />Type a goal above to start.</div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`task-item ${selectedId === task.id ? "selected" : ""}`}
                    onClick={() => setSelectedId(task.id)}
                  >
                    <div className="task-item-header">
                      <span className={`status-badge status-${task.status}`}>
                        {task.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="task-item-goal">{task.goal}</div>
                    <div className="task-item-meta">
                      {task.providerId} · {task.steps.length} steps · {new Date(task.updatedAt).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Detail pane */}
          <div className="detail">
            {!selectedTask ? (
              <div className="detail-empty">
                <div className="detail-empty-icon">⚡</div>
                <div className="detail-empty-text">Select a task to view its logs</div>
              </div>
            ) : (
              <>
                {/* Detail header */}
                <div className="detail-header">
                  <div className="detail-goal">{selectedTask.goal}</div>
                  <div className="detail-meta">
                    <span className={`status-badge status-${selectedTask.status}`}>
                      {selectedTask.status.replace("_", " ")}
                    </span>
                    <span style={{ color: "var(--text-dim)", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>
                      {selectedTask.providerId} · {selectedTask.steps.length} steps
                    </span>
                    <span style={{ color: "var(--text-dim)", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>
                      {new Date(selectedTask.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {/* Controls */}
                  {(() => {
                    const s = selectedTask.status;
                    const isActive = s === "thinking" || s === "acting";
                    const isPaused = s === "paused";
                    const isWaiting = s === "waiting_user";
                    if (!isActive && !isPaused && !isWaiting) return null;
                    return (
                      <div className="detail-controls">
                        {isActive && (
                          <button className="ctrl-btn pause" onClick={() => void handlePause(selectedTask.id)}>
                            ⏸ Pause
                          </button>
                        )}
                        {isPaused && (
                          <button className="ctrl-btn resume" onClick={() => void handleResume(selectedTask.id)}>
                            ▶ Resume
                          </button>
                        )}
                        {isWaiting && (
                          <button className="ctrl-btn approve" onClick={() => void handleApprove(selectedTask.id, true)}>
                            ✓ Approve
                          </button>
                        )}
                        {(isActive || isPaused || isWaiting) && (
                          <button className="ctrl-btn cancel" onClick={() => void handleCancel(selectedTask.id)}>
                            ✕ Cancel
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Safety warning */}
                {!safetyMode && (selectedTask.status === "thinking" || selectedTask.status === "acting" || selectedTask.status === "paused") && (
                  <div className="safety-warning">
                    ⚠ Safety mode is OFF — agent can fill forms and run scripts on pages
                  </div>
                )}

                {/* Result / error */}
                {selectedTask.status === "completed" && selectedTask.result && (
                  <div className="result-banner success">✓ {selectedTask.result}</div>
                )}
                {selectedTask.status === "error" && selectedTask.error && (
                  <div className="result-banner error">✗ {selectedTask.error}</div>
                )}

                {/* Log pane */}
                <div className="log-pane">
                  <div className="log-section-title">
                    <span>Agent Log</span>
                    <span>{selectedTask.steps.length} steps</span>
                  </div>
                  {selectedTask.steps.length === 0 ? (
                    <div style={{ padding: "20px 24px", color: "var(--text-dim)", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>
                      No steps recorded yet…
                    </div>
                  ) : (
                    selectedTask.steps.map((step, i) => (
                      <div key={step.id} className="step-row">
                        <span className="step-num">{i + 1}</span>
                        <span className="step-type">[{stepLabel(step.type)}]</span>
                        <span
                          className={`step-content ${step.error ? "has-error" : step.output ? "has-output" : ""}`}
                        >
                          {stepSummary(step)}
                        </span>
                        <span className="step-time">{new Date(step.timestamp).toLocaleTimeString()}</span>
                        {step.durationMs !== undefined && (
                          <span className="step-dur">{step.durationMs}ms</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Status bar */}
        <div className="statusbar">
          <span className="statusbar-text">
            {activeTasks > 0 ? `${activeTasks} active` : "idle"} · {tasks.filter((t) => t.status === "completed").length} completed · {safetyMode ? "🛡 safe mode on" : "⚠ safe mode off"}
          </span>
          <span className="statusbar-text">BrowserAgent</span>
        </div>
      </div>
    </>
  );
}
