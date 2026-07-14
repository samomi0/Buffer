import { useState } from "react";
import { useAppStore, type ToolManifest } from "../../stores/appStore";
import "./AppTopBar.css";

export function AppTopBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const tools = useAppStore((s) => s.tools);
  const activeToolId = useAppStore((s) => s.activeToolId);
  const topbarToolIds = useAppStore((s) => s.topbarToolIds);
  const pushTool = useAppStore((s) => s.pushTool);
  const popTool = useAppStore((s) => s.popTool);

  const visibleTools = topbarToolIds
    .map((id) => tools.find((tool) => tool.id === id))
    .filter((tool): tool is ToolManifest => Boolean(tool));

  const handleMenuItem = (id: string) => {
    setMenuOpen(false);
    if (id === "dashboard") popTool();
    else pushTool(id);
  };

  return (
    <header className="app-topbar">
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
          title="仪表板"
        >
          <HomeIcon />
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
      </div>

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
                onClick={() => handleMenuItem("dashboard")}
              >
                <HomeIcon /> 仪表板
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

function HomeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
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
