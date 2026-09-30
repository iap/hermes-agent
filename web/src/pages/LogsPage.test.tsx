// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getLogs: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: apiMocks,
}));

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function waitFor(cond: () => boolean, timeoutMs = 5000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor: condition never became true");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
}

function click(el: Element | null) {
  if (!el) throw new Error("element not rendered");
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

const FIXTURE = [
  "2026-09-30 08:00:01,984 INFO  tools     read_file completed in 121ms",
  "2026-09-30 08:00:04,027 ERROR tools     web_fetch failed: DNS lookup timed out",
];

// The pilot port: the page's filter controls are @trade/ui components. These
// assertions pin the integration — the library's controls render inside the
// dashboard's provider tree and the page's own data flow still drives them.
async function renderLogsPage() {
  apiMocks.getLogs.mockResolvedValue({ lines: FIXTURE });
  const [{ default: LogsPage }, { I18nProvider }, { PageHeaderProvider }] =
    await Promise.all([
      import("./LogsPage"),
      import("@/i18n"),
      import("@/contexts/PageHeaderProvider"),
    ]);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/logs"]}>
          <PageHeaderProvider pluginTabs={[]}>
            <LogsPage />
          </PageHeaderProvider>
        </MemoryRouter>
      </I18nProvider>,
    ),
  );
  await waitFor(() => document.body.textContent?.includes("web_fetch failed") ?? false);
}

beforeEach(() => {
  apiMocks.getLogs.mockReset();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect() {}
      observe() {}
      unobserve() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    addEventListener() {},
    matches: false,
    media: "",
    removeEventListener() {},
  }));
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.unstubAllGlobals();
});

describe("LogsPage — @trade/ui pilot port", () => {
  it("renders the filter controls as @trade/ui components and shows log lines", async () => {
    await renderLogsPage();
    expect(document.querySelector(".ui-tabs [role='tablist']")).toBeTruthy();
    expect(document.querySelectorAll(".ui-tabs [role='tab']").length).toBe(3);
    expect(document.querySelectorAll(".ui-field").length).toBe(3);
    expect(document.querySelectorAll("[role='combobox']").length).toBe(3);
    expect(document.body.textContent).toContain("web_fetch failed");
  });

  it("switching the file tab refetches through the page's own data layer", async () => {
    await renderLogsPage();
    const tabs = Array.from(document.querySelectorAll(".ui-tabs [role='tab']"));
    const errorsTab = tabs.find((tab) => tab.textContent === "ERRORS");
    await act(async () => {
      click(errorsTab ?? null);
    });
    await waitFor(() =>
      apiMocks.getLogs.mock.calls.some((call) => (call[0] as { file?: string })?.file === "errors"),
    );
    expect(
      apiMocks.getLogs.mock.calls.some((call) => (call[0] as { file?: string })?.file === "errors"),
    ).toBe(true);
  });
});
