import { useState } from "react";
import { useAppStore } from "../../stores/appStore";
import "./DashboardTopBar.css";

const MENU_ITEMS = [
  { id: "dashboard", label: "仪表板", icon: HomeIcon },
  { id: "Settings", label: "设置", icon: SettingsIcon },
];

export function DashboardTopBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pushTool = useAppStore((s) => s.pushTool);

  const handleMenuItem = (id: string) => {
    setMenuOpen(false);
    if (id !== "dashboard") pushTool(id);
  };

  return (
    <header className="dash-topbar">
      <button
        className="dash-menu-btn"
        onClick={() => setMenuOpen((v) => !v)}
        title="菜单"
        aria-label="打开菜单"
      >
        <MenuIcon />
      </button>

      <span className="dash-brand">Buffer</span>

      {menuOpen && (
        <>
          <div className="dash-menu-backdrop" onClick={() => setMenuOpen(false)} />
          <nav className="dash-menu-drawer">
            <div className="dash-menu-header">
              <span className="dash-menu-brand">Buffer</span>
              <button
                className="dash-menu-close"
                onClick={() => setMenuOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="dash-menu-items">
              {MENU_ITEMS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={`dash-menu-item ${id === "dashboard" ? "active" : ""}`}
                  onClick={() => handleMenuItem(id)}
                >
                  <Icon />
                  <span>{label}</span>
                </button>
              ))}
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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}
