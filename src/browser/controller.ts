import type {
  BrowserAction,
  BrowserActionResult,
  PageContext,
  InteractiveElement,
} from "@/shared/types";

// ─── Browser Controller ───────────────────────────────────────────────────────

export class BrowserController {
  private debuggerAttached = new Set<number>();

  // ── High-level page context ─────────────────────────────────────────────────

  async getActivePageContext(withScreenshot = true): Promise<PageContext> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab found");

    const [ctx] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContext,
    });

    const screenshot = withScreenshot ? await this.takeScreenshot(tab.id) : undefined;
    const dom = (ctx?.result as { dom?: string } | undefined)?.dom;
    const interactiveElements = (ctx?.result as { elements?: InteractiveElement[] } | undefined)?.elements;

    return {
      url: tab.url ?? "",
      title: tab.title ?? "",
      ...(screenshot !== undefined && { screenshot }),
      ...(dom !== undefined && { dom }),
      ...(interactiveElements !== undefined && { interactiveElements }),
    };
  }

  // ── Core action dispatcher ──────────────────────────────────────────────────

  async execute(action: BrowserAction): Promise<BrowserActionResult> {
    const tabId = action.tabId ?? (await this.getActiveTabId());

    try {
      switch (action.type) {
        case "navigate":
          return await this.navigate(tabId, action.params["url"] as string);

        case "click":
          return await this.click(tabId, action.params["selector"] as string);

        case "type":
          return await this.type(
            tabId,
            action.params["selector"] as string,
            action.params["text"] as string,
            action.params["clearFirst"] as boolean | undefined
          );

        case "scroll":
          return await this.scroll(
            tabId,
            action.params["direction"] as "up" | "down",
            action.params["amount"] as number | undefined
          );

        case "screenshot":
          return { success: true, screenshot: await this.takeScreenshot(tabId) };

        case "extract_dom":
          return await this.extractDOM(tabId);

        case "extract_text":
          return await this.extractText(tabId, action.params["selector"] as string | undefined);

        case "wait":
          await sleep(action.params["ms"] as number ?? 1000);
          return { success: true };

        case "evaluate_js":
          return await this.evaluateJS(tabId, action.params["script"] as string);

        case "new_tab":
          return await this.newTab(action.params["url"] as string | undefined);

        case "close_tab":
          await chrome.tabs.remove(tabId);
          return { success: true };

        case "back":
          await chrome.tabs.goBack(tabId);
          return { success: true };

        case "forward":
          await chrome.tabs.goForward(tabId);
          return { success: true };

        case "hover":
          return await this.hover(tabId, action.params["selector"] as string);

        case "select_option":
          return await this.selectOption(
            tabId,
            action.params["selector"] as string,
            action.params["value"] as string
          );

        case "fill_form":
          return await this.fillForm(
            tabId,
            action.params["fields"] as Record<string, string>
          );

        case "get_cookies":
          return await this.getCookies(action.params["url"] as string | undefined);

        default:
          return { success: false, error: `Unknown action type: ${action.type}` };
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ── Individual actions ──────────────────────────────────────────────────────

  private async navigate(tabId: number, url: string): Promise<BrowserActionResult> {
    // Ensure URL has a protocol
    const safeUrl = url.startsWith("http") ? url : `https://${url}`;
    await chrome.tabs.update(tabId, { url: safeUrl });

    // Wait for navigation to complete
    await this.waitForLoad(tabId);
    return { success: true, data: { url: safeUrl } };
  }

  private async click(tabId: number, selector: string): Promise<BrowserActionResult> {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (sel: string) => {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (!el) return { success: false, error: `Element not found: ${sel}` };
        el.click();
        return { success: true };
      },
      args: [selector],
    });
    return (result?.result as BrowserActionResult | undefined) ?? { success: false, error: "Script failed" };
  }

  private async type(
    tabId: number,
    selector: string,
    text: string,
    clearFirst = true
  ): Promise<BrowserActionResult> {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (sel: string, txt: string, clear: boolean) => {
        const el = document.querySelector(sel) as HTMLInputElement | null;
        if (!el) return { success: false, error: `Element not found: ${sel}` };
        el.focus();
        if (clear) el.value = "";
        // Simulate real typing for React/Vue controlled inputs
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        nativeInputValueSetter?.call(el, txt);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return { success: true };
      },
      args: [selector, text, clearFirst],
    });
    return (result?.result as BrowserActionResult | undefined) ?? { success: false, error: "Script failed" };
  }

  private async scroll(
    tabId: number,
    direction: "up" | "down",
    amount = 500
  ): Promise<BrowserActionResult> {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (dir: "up" | "down", amt: number) => {
        window.scrollBy({ top: dir === "down" ? amt : -amt, behavior: "smooth" });
      },
      args: [direction, amount],
    });
    return { success: true };
  }

  private async extractDOM(tabId: number): Promise<BrowserActionResult> {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Return simplified DOM for LLM consumption
        const clone = document.body.cloneNode(true) as HTMLElement;
        // Remove scripts and styles
        clone.querySelectorAll("script,style,svg,noscript").forEach((el) => el.remove());
        return { success: true, data: clone.innerText.substring(0, 20000) };
      },
    });
    return (result?.result as BrowserActionResult | undefined) ?? { success: false, error: "Script failed" };
  }

  private async extractText(
    tabId: number,
    selector?: string
  ): Promise<BrowserActionResult> {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (sel?: string) => {
        const el = sel ? document.querySelector(sel) : document.body;
        return { success: !!el, data: (el as HTMLElement | null)?.innerText?.substring(0, 20000) };
      },
      args: [selector],
    });
    return (result?.result as BrowserActionResult | undefined) ?? { success: false, error: "Script failed" };
  }

  private async evaluateJS(
    tabId: number,
    script: string
  ): Promise<BrowserActionResult> {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (code: string) => {
        try {
          // eslint-disable-next-line no-eval
          const res = eval(code);
          return { success: true, data: JSON.stringify(res) };
        } catch (e) {
          return { success: false, error: String(e) };
        }
      },
      args: [script],
    });
    return (result?.result as BrowserActionResult | undefined) ?? { success: false, error: "Script failed" };
  }

  private async hover(tabId: number, selector: string): Promise<BrowserActionResult> {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (sel: string) => {
        const el = document.querySelector(sel);
        if (!el) return { success: false, error: `Element not found: ${sel}` };
        el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
        return { success: true };
      },
      args: [selector],
    });
    return (result?.result as BrowserActionResult | undefined) ?? { success: false, error: "Script failed" };
  }

  private async selectOption(
    tabId: number,
    selector: string,
    value: string
  ): Promise<BrowserActionResult> {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (sel: string, val: string) => {
        const el = document.querySelector(sel) as HTMLSelectElement | null;
        if (!el) return { success: false, error: `Select element not found: ${sel}` };
        el.value = val;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return { success: true };
      },
      args: [selector, value],
    });
    return (result?.result as BrowserActionResult | undefined) ?? { success: false, error: "Script failed" };
  }

  private async fillForm(
    tabId: number,
    fields: Record<string, string>
  ): Promise<BrowserActionResult> {
    const results: Record<string, boolean> = {};
    for (const [selector, value] of Object.entries(fields)) {
      const res = await this.type(tabId, selector, value);
      results[selector] = res.success;
    }
    return { success: Object.values(results).every(Boolean), data: results };
  }

  private async newTab(url?: string): Promise<BrowserActionResult> {
    const tab = await chrome.tabs.create({ url, active: true });
    if (url) await this.waitForLoad(tab.id!);
    return { success: true, data: { tabId: tab.id } };
  }

  private async getCookies(url?: string): Promise<BrowserActionResult> {
    const cookies = await chrome.cookies.getAll(url ? { url } : {});
    return { success: true, data: cookies };
  }

  private async takeScreenshot(tabId: number): Promise<string> {
    const windowId = (await chrome.tabs.get(tabId)).windowId;
    return chrome.tabs.captureVisibleTab(windowId, { format: "jpeg", quality: 60 });
  }

  private async waitForLoad(tabId: number, timeoutMs = 10_000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(); // resolve anyway — page might be slow
      }, timeoutMs);

      const listener = (
        id: number,
        info: chrome.tabs.TabChangeInfo
      ) => {
        if (id === tabId && info.status === "complete") {
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(resolve, 500); // small extra wait for JS hydration
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  private async getActiveTabId(): Promise<number> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab");
    return tab.id;
  }
}

// ─── Content-script-side helpers (injected into page) ────────────────────────

function extractPageContext(): { dom: string; elements: InteractiveElement[] } {
  const clone = document.body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("script,style,svg,noscript").forEach((el) => el.remove());
  const dom = clone.innerText.substring(0, 15_000);

  const selectors = [
    "a[href]",
    "button",
    "input:not([type=hidden])",
    "select",
    "textarea",
    '[role="button"]',
    '[role="link"]',
  ];

  const elements: InteractiveElement[] = [];
  let index = 0;

  document.querySelectorAll<HTMLElement>(selectors.join(",")).forEach((el) => {
    if (index >= 50) return; // Limit to 50 elements to keep context size manageable

    const tag = el.tagName.toLowerCase();
    let type: InteractiveElement["type"] = "button";

    if (tag === "a") type = "link";
    else if (tag === "input") {
      const inputType = (el as HTMLInputElement).type;
      if (inputType === "checkbox") type = "checkbox";
      else if (inputType === "radio") type = "radio";
      else type = "input";
    } else if (tag === "select") type = "select";
    else if (tag === "textarea") type = "textarea";

    // Generate a unique selector
    const id = el.id ? `#${el.id}` : "";
    const cls = el.className
      ? `.${[...el.classList].slice(0, 2).join(".")}`
      : "";
    const selector =
      id || `${tag}${cls}:nth-of-type(${index + 1})`;

    const text = el.innerText?.substring(0, 100) || undefined;
    const placeholder = (el as HTMLInputElement).placeholder || undefined;
    const href = (el as HTMLAnchorElement).href || undefined;
    elements.push({
      index: index++,
      type,
      selector,
      ...(text !== undefined && { text }),
      ...(placeholder !== undefined && { placeholder }),
      ...(href !== undefined && { href }),
    });
  });

  return { dom, elements };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type { PageContext };
