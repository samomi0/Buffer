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
    case "DshWeb":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="1.36em" height="1em" viewBox="0 0 256 189">
          <path d="M0 0h256v189H0z" fill="none" />
          <path fill="#4d6bfe" d="M253.314 15.812c-2.711-1.329-3.88 1.203-5.465 2.49c-.542.414-1.001.954-1.46 1.452c-3.963 4.232-8.594 7.013-14.643 6.68c-8.845-.497-16.396 2.284-23.071 9.048c-1.419-8.341-6.133-13.322-13.309-16.517c-3.754-1.66-7.55-3.32-10.179-6.931c-1.836-2.572-2.336-5.436-3.254-8.258c-.584-1.702-1.168-3.445-3.13-3.736c-2.127-.331-2.961 1.452-3.796 2.947c-3.337 6.101-4.63 12.824-4.506 19.63c.292 15.315 6.759 27.515 19.608 36.19c1.46.995 1.836 1.99 1.377 3.444c-.876 2.988-1.92 5.893-2.837 8.88c-.584 1.91-1.46 2.325-3.504 1.494c-7.051-2.945-13.142-7.304-18.524-12.574c-9.136-8.84-17.397-18.592-27.701-26.228a121 121 0 0 0-7.343-5.022c-10.513-10.209 1.377-18.593 4.13-19.588c2.879-1.038 1.002-4.607-8.302-4.565s-17.814 3.154-28.66 7.304c-1.586.623-3.255 1.079-4.966 1.452c-9.845-1.867-20.066-2.283-30.747-1.079c-20.108 2.241-36.17 11.745-47.976 27.972C.872 59.802-2.466 81.963 1.623 105.079c4.297 24.36 16.729 44.53 35.837 60.301c19.816 16.35 42.637 24.36 68.67 22.825c15.81-.913 33.416-3.029 53.275-19.837c5.005 2.49 10.262 3.486 18.982 4.233c6.717.623 13.183-.332 18.19-1.369c7.842-1.66 7.3-8.923 4.464-10.25c-22.988-10.708-17.94-6.35-22.529-9.878c11.681-13.82 29.287-28.18 36.17-74.702c.543-3.693.084-6.018 0-9.006c-.041-1.825.376-2.53 2.462-2.739c5.757-.664 11.348-2.24 16.48-5.062c14.893-8.134 20.9-21.498 22.318-37.517c.21-2.449-.041-4.98-2.628-6.266M123.526 159.985c-22.278-17.513-33.083-23.282-37.547-23.033c-4.172.25-3.42 5.022-2.503 8.135c.96 3.07 2.211 5.187 3.963 7.884c1.21 1.785 2.045 4.44-1.21 6.433c-7.175 4.44-19.65-1.494-20.234-1.784c-14.518-8.55-26.658-19.839-35.21-35.276c-8.261-14.858-13.058-30.794-13.851-47.81c-.21-4.107 1-5.56 5.09-6.307c5.38-.996 10.93-1.204 16.311-.416C61.073 71.131 80.43 81.3 96.66 97.401c9.261 9.172 16.27 20.129 23.488 30.836c7.676 11.37 15.936 22.203 26.45 31.084c3.712 3.112 6.674 5.478 9.511 7.221c-8.552.955-22.82 1.163-32.582-6.557m10.68-68.684a3.27 3.27 0 0 1 3.296-3.278c.418 0 .793.082 1.127.206c.46.167.876.416 1.21.789c.584.581.918 1.41.918 2.283a3.267 3.267 0 0 1-3.296 3.278c-1.835 0-3.254-1.452-3.254-3.278m33.167 17.016c-2.128.872-4.255 1.618-6.3 1.701c-3.17.166-6.633-1.121-8.51-2.698c-2.92-2.449-5.006-3.817-5.882-8.092c-.376-1.826-.167-4.649.167-6.267c.75-3.486-.084-5.726-2.545-7.76c-2.003-1.661-4.548-2.117-7.343-2.117c-1.043 0-2.002-.457-2.712-.83c-1.168-.581-2.127-2.034-1.21-3.818c.293-.58 1.711-1.992 2.045-2.24c3.797-2.16 8.177-1.453 12.224.165c3.755 1.535 6.592 4.358 10.68 8.341c4.172 4.814 4.923 6.143 7.3 9.753c1.879 2.822 3.59 5.727 4.757 9.048c.71 2.075-.209 3.776-2.67 4.814z" />
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
