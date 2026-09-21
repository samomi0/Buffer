import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../core/stores/appStore";
import "./BrowserPage.css";

export interface PresetTool {
  id: string;
  title: string;
  url: string;
  description: string;
  badge: string;
}

export const PRESET_TOOLS: PresetTool[] = [
  {
    id: "WICacheViewer",
    title: "WI 缓存查看器",
    url: "/custom-tools/WICacheViewer/index.html",
    description: "查看与管理堆场块、工作队列及流向统计缓存",
    badge: "本地页面",
  },
  {
    id: "YardOverViewEditor",
    title: "堆场总览编辑器",
    url: "/custom-tools/YardOverViewEditor/index.html",
    description: "编辑岸线、泊位、堆区、桥吊与闸口总览布局",
    badge: "本地页面",
  },
  {
    id: "HarnessWeb",
    title: "Harness Web",
    url: "http://127.0.0.1:3080",
    description: "DeepSeek Harness 网页控制台（端口 3080）",
    badge: "服务地址",
  },
];

interface TabItem {
  id: string;
  title: string;
  url: string;
  inputUrl: string;
  refreshKey: number;
}

interface BrowserPageProps {
  initialUrl?: string;
  initialTitle?: string;
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) {
    return trimmed;
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    return trimmed;
  }
  return `http://${trimmed}`;
}

export function BrowserPage({ initialUrl, initialTitle }: BrowserPageProps) {
  const closeTool = useAppStore((s) => s.closeTool);
  const dataDir = useAppStore((s) => s.dataDir);

  const initialTabUrl = initialUrl ? normalizeUrl(initialUrl) : "";
  const initialTabTitle = initialTitle || (initialTabUrl ? "页面" : "新标签页");

  const [tabs, setTabs] = useState<TabItem[]>(() => [
    {
      id: "tab-1",
      title: initialTabTitle,
      url: initialTabUrl,
      inputUrl: initialTabUrl,
      refreshKey: 1,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("tab-1");
  const tabCounterRef = useRef<number>(1);
  const frameRefs = useRef<Record<string, HTMLIFrameElement | null>>({});

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  /* 快捷键 Ctrl+K 返回 */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        closeTool();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeTool]);

  /* 静态页面模板数据通信 postMessage bridge */
  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      if (!dataDir) return;
      const targetFrame = activeTab ? frameRefs.current[activeTab.id] : null;

      if (e.data?.type === "mp-request-templates") {
        try {
          const raw: string = await invoke("read_msg_templates", { dataDir });
          targetFrame?.contentWindow?.postMessage(
            { type: "mp-templates-data", templates: JSON.parse(raw) },
            "*"
          );
        } catch {
          targetFrame?.contentWindow?.postMessage(
            { type: "mp-templates-data", templates: [] },
            "*"
          );
        }
      } else if (e.data?.type === "mp-save-templates") {
        try {
          await invoke("write_msg_templates", {
            dataDir,
            json: JSON.stringify(e.data.templates, null, 2),
          });
        } catch {
          /* ignore */
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [dataDir, activeTab]);

  /* 新建标签 */
  const handleNewTab = useCallback((urlToOpen = "", titleToOpen = "新标签页") => {
    tabCounterRef.current += 1;
    const newId = `tab-${tabCounterRef.current}`;
    const normalized = normalizeUrl(urlToOpen);
    const newTab: TabItem = {
      id: newId,
      title: titleToOpen,
      url: normalized,
      inputUrl: normalized,
      refreshKey: 1,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  }, []);

  /* 关闭标签 */
  const handleCloseTab = useCallback((idToClose: string) => {
    setTabs((prev) => {
      if (prev.length <= 1) {
        // 关闭最后一个时，重置为一个新的空白页
        tabCounterRef.current += 1;
        const freshId = `tab-${tabCounterRef.current}`;
        setActiveTabId(freshId);
        return [
          {
            id: freshId,
            title: "新标签页",
            url: "",
            inputUrl: "",
            refreshKey: 1,
          },
        ];
      }
      const filtered = prev.filter((t) => t.id !== idToClose);
      if (activeTabId === idToClose) {
        const closedIdx = prev.findIndex((t) => t.id === idToClose);
        const nextActive = filtered[Math.max(0, closedIdx - 1)]?.id ?? filtered[0].id;
        setActiveTabId(nextActive);
      }
      return filtered;
    });
    delete frameRefs.current[idToClose];
  }, [activeTabId]);

  /* 导航至指定地址 */
  const handleNavigate = (rawUrl: string, title?: string) => {
    if (!activeTab) return;
    const normalized = normalizeUrl(rawUrl);
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTab.id) return t;
        const newTitle = title || (normalized ? normalized.replace(/^https?:\/\//, "") : "新标签页");
        return {
          ...t,
          url: normalized,
          inputUrl: normalized,
          title: newTitle,
          refreshKey: t.refreshKey + 1,
        };
      })
    );
  };

  /* 地址栏输入更新 */
  const handleInputChange = (val: string) => {
    if (!activeTab) return;
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTab.id ? { ...t, inputUrl: val } : t))
    );
  };

  /* 刷新当前页面 */
  const handleRefresh = () => {
    if (!activeTab) return;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id ? { ...t, refreshKey: t.refreshKey + 1 } : t
      )
    );
  };

  /* 回到主页（清空当前标签地址并回到起始面板） */
  const handleGoHome = () => {
    if (!activeTab) return;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id
          ? {
              ...t,
              url: "",
              inputUrl: "",
              title: "新标签页",
              refreshKey: t.refreshKey + 1,
            }
          : t
      )
    );
  };

  return (
    <div className="browser-shell">
      {/* 顶部标签栏（像终端标签栏一样的交互能力） */}
      <div className="browser-tabs-bar">
        <div className="browser-tabs-list">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                className={`browser-tab ${isActive ? "active" : ""}`}
                onClick={() => setActiveTabId(tab.id)}
                title={tab.url || "新标签页"}
              >
                <span className="browser-tab-icon">
                  <PageIcon />
                </span>
                <span className="browser-tab-title">{tab.title || "新标签页"}</span>
                <button
                  type="button"
                  className="browser-tab-close"
                  title="关闭标签"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTab(tab.id);
                  }}
                >
                  <CloseIcon />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            className="browser-new-tab-btn"
            title="新建标签页"
            onClick={() => handleNewTab()}
          >
            <PlusIcon />
          </button>
        </div>
        <span className="browser-tabs-hint">Ctrl+K 返回</span>
      </div>

      {/* 导航与地址栏 */}
      <div className="browser-toolbar">
        <div className="browser-nav-actions">
          <button
            type="button"
            className="browser-action-btn"
            title="主页"
            onClick={handleGoHome}
          >
            <HomeIcon />
          </button>
          <button
            type="button"
            className="browser-action-btn"
            title="刷新"
            onClick={handleRefresh}
            disabled={!activeTab?.url}
          >
            <RefreshIcon />
          </button>
        </div>

        <form
          className="browser-address-bar"
          onSubmit={(e) => {
            e.preventDefault();
            if (activeTab) handleNavigate(activeTab.inputUrl);
          }}
        >
          <span className="browser-address-icon">
            <GlobeIcon />
          </span>
          <input
            type="text"
            className="browser-address-input"
            value={activeTab?.inputUrl ?? ""}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="输入访问地址（如 http://127.0.0.1:3080 或 /custom-tools/...）"
          />
          <button type="submit" className="browser-go-btn" title="访问">
            <ArrowRightIcon />
          </button>
        </form>

        <div className="browser-quick-chips">
          {PRESET_TOOLS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`browser-quick-chip ${activeTab?.url === preset.url ? "active" : ""}`}
              onClick={() => handleNavigate(preset.url, preset.title)}
              title={`${preset.title}: ${preset.description}`}
            >
              <ChipIcon />
              <span>{preset.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 浏览器主体视图 */}
      <div className="browser-body">
        {tabs.map((tab) => {
          const isCurrent = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className="browser-tab-pane"
              style={{ display: isCurrent ? "flex" : "none" }}
            >
              {tab.url ? (
                <iframe
                  ref={(el) => {
                    frameRefs.current[tab.id] = el;
                  }}
                  key={`${tab.url}-${tab.refreshKey}`}
                  src={tab.url}
                  className="browser-iframe"
                  title={tab.title}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              ) : (
                <div className="browser-home-portal">
                  <div className="browser-home-box">
                    <div className="browser-home-header">
                      <div className="browser-home-brand-icon">
                        <BrowserIcon />
                      </div>
                      <h2>内嵌浏览器</h2>
                      <p>支持访问内嵌工具、本地静态页面以及局域网与网络服务地址</p>
                    </div>

                    <div className="browser-home-quick-grid">
                      {PRESET_TOOLS.map((item) => (
                        <div
                          key={item.id}
                          className="browser-home-card"
                          onClick={() => handleNavigate(item.url, item.title)}
                        >
                          <div className="browser-home-card-top">
                            <span className="browser-home-card-badge">{item.badge}</span>
                            <span className="browser-home-card-open">
                              <LaunchIcon />
                            </span>
                          </div>
                          <div className="browser-home-card-title">{item.title}</div>
                          <div className="browser-home-card-desc">{item.description}</div>
                          <div className="browser-home-card-url">{item.url}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── 统一纯 SVG 图标，严格无 emoji ── */

function PageIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function ChipIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  );
}

function BrowserIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="18" rx="3" />
      <line x1="2" y1="8" x2="22" y2="8" />
      <circle cx="5.5" cy="5.5" r="0.8" fill="currentColor" />
      <circle cx="8.5" cy="5.5" r="0.8" fill="currentColor" />
      <circle cx="11.5" cy="5.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

function LaunchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
