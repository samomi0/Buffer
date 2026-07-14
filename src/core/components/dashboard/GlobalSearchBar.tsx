import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useAppStore } from "../../stores/appStore";
import "./GlobalSearchBar.css";

export function GlobalSearchBar() {
  const tools = useAppStore((s) => s.tools);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const pushTool = useAppStore((s) => s.pushTool);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return tools;
    const q = searchQuery.toLowerCase();
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    );
  }, [tools, searchQuery]);

  const showDropdown = focused && filtered.length > 0;

  useEffect(() => {
    setSelectedIdx(0);
  }, [searchQuery]);

  // Global Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const open = useCallback(
    (id: string) => {
      setSearchQuery("");
      pushTool(id);
    },
    [setSearchQuery, pushTool]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIdx]) open(filtered[selectedIdx].id);
    } else if (e.key === "Escape") {
      setSearchQuery("");
      inputRef.current?.blur();
    }
  };

  return (
    <div className="gsb-wrap">
      <div
        className={`gsb-box ${focused ? "focused" : ""}`}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            inputRef.current?.focus();
          }
        }}
      >
        <SearchIcon />
        <input
          ref={inputRef}
          type="text"
          className="gsb-input"
          placeholder="搜索工具、快捷命令..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
        />
        <kbd className="gsb-shortcut">Ctrl+K</kbd>
        {searchQuery && (
          <button
            className="gsb-clear"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setSearchQuery(""); inputRef.current?.focus(); }}
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="gsb-dropdown">
          {filtered.map((tool, i) => (
            <button
              key={tool.id}
              className={`gsb-result-item ${i === selectedIdx ? "selected" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => open(tool.id)}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              <span className="gsb-result-icon"><ToolIcon toolId={tool.id} /></span>
              <span className="gsb-result-name">{tool.name}</span>
              <span className="gsb-result-desc">{tool.description}</span>
            </button>
          ))}
          <div className="gsb-dropdown-hint">
            <span><kbd>上/下</kbd> 导航</span>
            <span><kbd>回车</kbd> 打开</span>
            <span><kbd>Esc</kbd> 清空</span>
          </div>
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg className="gsb-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function ToolIcon({ toolId }: { toolId: string }) {
  switch (toolId) {
    case "DevLog":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          <line x1="8" y1="7" x2="16" y2="7" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      );
    case "SecureVault":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="11" width="16" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 118 0v3" />
        </svg>
      );
    case "MsgParser":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 8l-4 4 4 4" />
          <path d="M17 8l4 4-4 4" />
          <path d="M14 4l-4 16" />
        </svg>
      );
    case "WICacheViewer":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="7" ry="3" />
          <path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
          <path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
        </svg>
      );
    default:
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M9 12h6" />
          <path d="M12 9v6" />
        </svg>
      );
  }
}
