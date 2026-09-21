import { useState } from "react";
import { useAppStore, type ToolManifest, type AppTheme } from "../../stores/appStore";
import { readWorkbenchSettings, writeWorkbenchSettings } from "../../lib/workbenchSettings";
import { useWindowChrome } from "../chrome/windowChrome";
import { WindowControls } from "../chrome/WindowControls";
import "./AppTopBar.css";

export function AppTopBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { onTitlebarMouseDown } = useWindowChrome();
  const tools = useAppStore((s) => s.tools);
  const activeToolId = useAppStore((s) => s.activeToolId);
  const topbarToolIds = useAppStore((s) => s.topbarToolIds);
  const pushTool = useAppStore((s) => s.pushTool);
  const popTool = useAppStore((s) => s.popTool);
  const dataDir = useAppStore((s) => s.dataDir);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  const toggleTheme = async () => {
    const next: AppTheme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (!dataDir) return;
    try {
      const settings = await readWorkbenchSettings(dataDir);
      await writeWorkbenchSettings(dataDir, {
        ...settings,
        appearance: { ...(settings.appearance ?? {}), theme: next },
      });
    } catch {
      /* ignore */
    }
  };

  const visibleTools = topbarToolIds
    .map((id) => tools.find((tool) => tool.id === id))
    .filter((tool): tool is ToolManifest => Boolean(tool));

  const handleMenuItem = (id: string) => {
    setMenuOpen(false);
    if (id === "calendar" || id === "dashboard") popTool();
    else pushTool(id);
  };

  return (
    <header className="app-topbar" onMouseDown={onTitlebarMouseDown}>
      <button
        className="app-topbar-menu-btn"
        onClick={() => setMenuOpen((v) => !v)}
        title="菜单"
      >
        <MenuIcon />
      </button>

      <span className="app-topbar-brand">Buffer</span>

      <div className="app-topbar-tools">
        <button
          className={`app-topbar-chip ${!activeToolId ? "active" : ""}`}
          onClick={popTool}
          title="日历"
        >
          <CalendarIcon />
        </button>
        {visibleTools.map((tool) => (
          <button
            key={tool.id}
            className={`app-topbar-chip ${activeToolId === tool.id ? "active" : ""}`}
            onClick={() => pushTool(tool.id)}
            title={tool.name}
          >
            <ToolIcon toolId={tool.id} />
          </button>
        ))}
        <span className="app-topbar-sep" />
        <button
          className={`app-topbar-chip ${activeToolId === "Settings" ? "active" : ""}`}
          onClick={() => pushTool("Settings")}
          title="设置"
        >
          <SettingsIcon />
        </button>
        <button
          className={`app-topbar-chip theme ${theme === "dark" ? "active" : ""}`}
          onClick={() => void toggleTheme()}
          title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
          aria-label="切换明暗主题"
          aria-pressed={theme === "dark"}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>

      <WindowControls />

      {menuOpen && (
        <>
          <div className="app-topbar-backdrop" onClick={() => setMenuOpen(false)} />
          <nav className="app-topbar-drawer">
            <div className="app-topbar-drawer-head">
              <span>Buffer</span>
              <button className="app-topbar-drawer-close" onClick={() => setMenuOpen(false)}>
                <CloseIcon />
              </button>
            </div>
            <div className="app-topbar-drawer-items">
              <button
                className={`app-topbar-drawer-item ${!activeToolId ? "active" : ""}`}
                onClick={() => handleMenuItem("calendar")}
              >
                <CalendarIcon /> 日历
              </button>
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  className={`app-topbar-drawer-item ${activeToolId === tool.id ? "active" : ""}`}
                  onClick={() => handleMenuItem(tool.id)}
                >
                  <ToolIcon toolId={tool.id} /> {tool.name}
                </button>
              ))}
              <div className="app-topbar-drawer-divider" />
              <button
                className={`app-topbar-drawer-item ${activeToolId === "Settings" ? "active" : ""}`}
                onClick={() => handleMenuItem("Settings")}
              >
                <SettingsIcon /> 设置
              </button>
            </div>
          </nav>
        </>
      )}
    </header>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

function ToolIcon({ toolId }: { toolId: string }) {
  switch (toolId) {
    case "DevLog":
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          <line x1="8" y1="7" x2="16" y2="7" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      );
    case "SecureVault":
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="11" width="16" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 118 0v3" />
        </svg>
      );
    case "MsgParser":
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 8l-4 4 4 4" />
          <path d="M17 8l4 4-4 4" />
          <path d="M14 4l-4 16" />
        </svg>
      );
    case "Browser":
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="18" rx="3" />
          <line x1="2" y1="8" x2="22" y2="8" />
          <circle cx="5" cy="5.5" r="0.6" fill="currentColor" />
          <circle cx="8" cy="5.5" r="0.6" fill="currentColor" />
          <circle cx="11" cy="5.5" r="0.6" fill="currentColor" />
        </svg>
      );
    case "Terminal":.581.918 1.41.918 2.283a3.267 3.267 0 0 1-3.296 3.278c-1.835 0-3.254-1.452-3.254-3.278m33.167 17.016c-2.128.872-4.255 1.618-6.3 1.701c-3.17.166-6.633-1.121-8.51-2.698c-2.92-2.449-5.006-3.817-5.882-8.092c-.376-1.826-.167-4.649.167-6.267c.75-3.486-.084-5.726-2.545-7.76c-2.003-1.661-4.548-2.117-7.343-2.117c-1.043 0-2.002-.457-2.712-.83c-1.168-.581-2.127-2.034-1.21-3.818c.293-.58 1.711-1.992 2.045-2.24c3.797-2.16 8.177-1.453 12.224.165c3.755 1.535 6.592 4.358 10.68 8.341c4.172 4.814 4.923 6.143 7.3 9.753c1.879 2.822 3.59 5.727 4.757 9.048c.71 2.075-.209 3.776-2.67 4.814z" />
        </svg>
      );
    case "Terminal":
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2.5" />
          <path d="M6 9l3.5 3L6 15" />
          <path d="M11.5 15H18" />
        </svg>
      );
    case "WICacheViewer":
    case "YardOverViewEditor":
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M12 8v8" />
          <path d="M8 12h8" />
        </svg>
      );
    default:
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M12 8v8" />
          <path d="M8 12h8" />
        </svg>
      );
  }
}
