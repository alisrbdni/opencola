/**
 * Content Script
 * Injected into every page. Enables the background service worker
 * to query and manipulate the page DOM via message passing.
 */

// ─── Listen for messages from background ─────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "PING") {
    sendResponse({ alive: true, url: window.location.href });
    return true;
  }

  if (message.type === "HIGHLIGHT_ELEMENT") {
    highlightElement(message.selector as string);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === "GET_FORM_FIELDS") {
    sendResponse({ fields: extractFormFields() });
    return true;
  }

  return false;
});

// ─── Visual feedback for agent actions ───────────────────────────────────────

function highlightElement(selector: string): void {
  // Remove previous highlights
  document.querySelectorAll("[data-agent-highlight]").forEach((el) => {
    (el as HTMLElement).style.outline = "";
    el.removeAttribute("data-agent-highlight");
  });

  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;

  el.setAttribute("data-agent-highlight", "true");
  el.style.outline = "2px solid #6366f1";
  el.style.outlineOffset = "2px";
  el.scrollIntoView({ behavior: "smooth", block: "center" });

  setTimeout(() => {
    el.style.outline = "";
    el.removeAttribute("data-agent-highlight");
  }, 2000);
}

function extractFormFields(): Array<{
  selector: string;
  type: string;
  name: string;
  label?: string;
}> {
  const fields: Array<{
    selector: string;
    type: string;
    name: string;
    label?: string;
  }> = [];

  document
    .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      "input:not([type=hidden]), select, textarea"
    )
    .forEach((el, i) => {
      const id = el.id ? `#${el.id}` : "";
      const name = el.name ? `[name="${el.name}"]` : "";
      const selector = id || name || `${el.tagName.toLowerCase()}:nth-of-type(${i + 1})`;

      // Find associated label
      let label: string | undefined;
      if (el.id) {
        label = document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim();
      }
      if (!label) {
        label = el.closest("label")?.textContent?.trim();
      }

      fields.push({
        selector,
        type: el.tagName === "INPUT" ? (el as HTMLInputElement).type : el.tagName.toLowerCase(),
        name: el.name || el.id || selector,
        ...(label !== undefined && { label }),
      });
    });

  return fields;
}

// ─── Inject a subtle status indicator ────────────────────────────────────────

function injectStatusIndicator(): void {
  const existing = document.getElementById("browser-agent-indicator");
  if (existing) return;

  const indicator = document.createElement("div");
  indicator.id = "browser-agent-indicator";
  indicator.style.cssText = `
    position: fixed;
    bottom: 16px;
    right: 16px;
    background: #6366f1;
    color: white;
    font-size: 11px;
    font-family: monospace;
    padding: 4px 8px;
    border-radius: 4px;
    z-index: 2147483647;
    display: none;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(99,102,241,0.4);
  `;
  indicator.textContent = "🤖 Agent active";
  document.body?.appendChild(indicator);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "AGENT_STATUS") {
    const indicator = document.getElementById("browser-agent-indicator");
    if (!indicator) return;

    if (message.status === "idle" || message.status === "completed") {
      indicator.style.display = "none";
    } else {
      indicator.style.display = "block";
      indicator.textContent = `🤖 ${message.status}...`;
    }
  }
});

// Wait for body before injecting UI
if (document.body) {
  injectStatusIndicator();
} else {
  document.addEventListener("DOMContentLoaded", injectStatusIndicator);
}

console.debug("[BrowserAgent] Content script loaded:", window.location.href);
