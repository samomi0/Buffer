import { useState, useRef, useEffect, useMemo } from "react";
import { useAppStore, type ToolManifest } from "../../stores/appStore";
import "./SearchLauncher.css";

const ICONS: Record<string, string> = {
  hash: "#",
  code: "<>",
  gear: "*",
  search: "/",
  file: "[]",
  data: "{}",
  tool: "+",
  browser: "//",
  terminal: ">_",
};

interface Props {
  tools: ToolManifest[];
  onOpenSettings: () => void;
}

export function SearchLauncher({ tools, onOpenSettings }: Props) {
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const openTool = useAppStore((s) => s.openTool);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return tools;
    const q = searchQuery.toLowerCase();
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    );
  }, [tools, searchQuery]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIdx(0);
  }, [searchQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIdx]) {
        openTool(filtered[selectedIdx].id);
      }
    } else if (e.key === "Escape") {
      setSearchQuery("");
      inputRef.current?.blur();
    }
  };

  const selectTool = (tool: ToolManifest) => {
    openTool(tool.id);
  };

  return (
    <div className="launcher-shell">
      <div className="launcher-center">
        <div className="launcher-card">
          <div className="launcher-input-row">
            <div className="launcher-search-wrap">
              <input
                ref={inputRef}
                type="text"
                className="launcher-input"
                placeholder="搜索工具..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              {searchQuery && (
                <button
                  className="launcher-clear"
                  onClick={() => setSearchQuery("")}
                  title="Clear"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {filtered.length > 0 && (
            <div className="launcher-results" ref={listRef}>
              {filtered.map((tool, i) => (
                <button
                  key={tool.id}
                  className={`launcher-item ${i === selectedIdx ? "active" : ""}`}
                  onClick={() => selectTool(tool)}
                  onMouseEnter={() => setSelectedIdx(i)}
                >
                  <span className="launcher-item-icon">
                    {ICONS[tool.icon] || tool.icon || "+"}
                  </span>
                  <span className="launcher-item-name">{tool.name}</span>
                  <span className="launcher-item-desc">{tool.description}</span>
                  <span className="launcher-item-hint">回车</span>
                </button>
              ))}
            </div>
          )}

          {searchQuery && filtered.length === 0 && (
            <div className="launcher-empty">无匹配工具</div>
          )}

          <div className="launcher-footer">
            <span className="launcher-hint">
              <kbd>上/下</kbd> 导航
            </span>
            <span className="launcher-hint">
              <kbd>回车</kbd> 打开
            </span>
            <span className="launcher-hint">
              <kbd>Esc</kbd> 清空
            </span>
          </div>
        </div>

        <div className="launcher-dock">
          <button
            className="launcher-dock-btn launcher-dock-btn--primary"
            onClick={() => openTool("DevLog")}
            title="开发手记"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
              <line x1="8" y1="7" x2="16" y2="7" /><line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
          <button
            className="launcher-dock-btn"
            onClick={onOpenSettings}
            title="设置"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
