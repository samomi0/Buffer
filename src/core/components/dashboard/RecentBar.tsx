import { useState } from "react";
import { useAppStore } from "../../stores/appStore";
import "./RecentBar.css";

function relativeTime(ts: number) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "刚刚";
  if (hours < 1) return `${mins}分钟前`;
  if (days < 1) return `${hours}小时前`;
  if (days === 1) return "昨天";
  if (days < 7) return `${days}天前`;
  return "上周";
}

export function RecentBar() {
  const tools = useAppStore((s) => s.tools);
  const recentTools = useAppStore((s) => s.recentTools);
  const pushTool = useAppStore((s) => s.pushTool);
  const togglePin = useAppStore((s) => s.togglePin);
  const [contextMenu, setContextMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  if (recentTools.length === 0) return null;

  // pinned first then by openedAt desc
  const sorted = [...recentTools].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.openedAt - a.openedAt;
  });

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setContextMenu({ id, x: e.clientX, y: e.clientY });
  };

  const closeContext = () => setContextMenu(null);

  return (
    <>
      <div className="recent-bar">
        <span className="recent-bar-label">最近打开</span>
        <div className="recent-bar-list">
          {sorted.map((r) => {
            const tool = tools.find((t) => t.id === r.id);
            if (!tool) return null;
            return (
              <button
                key={r.id}
                className={`recent-chip ${r.pinned ? "pinned" : ""}`}
                onClick={() => pushTool(r.id)}
                onContextMenu={(e) => handleContextMenu(e, r.id)}
                title={`${tool.name} · ${relativeTime(r.openedAt)}${r.pinned ? " · 已固定" : ""}`}
              >
                {r.pinned && <PinIcon />}
                <span className="recent-chip-icon"><ToolIcon toolId={r.id} /></span>
                <span className="recent-chip-name">{tool.name}</span>
                <span className="recent-chip-time">{relativeTime(r.openedAt)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {contextMenu && (
        <>
          <div className="recent-ctx-backdrop" onClick={closeContext} />
          <div
            className="recent-ctx-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              className="recent-ctx-item"
              onClick={() => {
                togglePin(contextMenu.id);
                closeContext();
              }}
            >
              <PinIcon />
              {recentTools.find((r) => r.id === contextMenu.id)?.pinned
                ? "取消固定"
                : "固定置顶"}
            </button>
          </div>
        </>
      )}
    </>
  );
}

function PinIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2l2.4 6.4H21l-5.4 4 2 6.4L12 15.3l-5.6 3.5 2-6.4L3 8.4h6.6L12 2z" />
    </svg>
  );
}

function ToolIcon({ toolId }: { toolId: string }) {
  switch (toolId) {
    case "DevLog":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          <line x1="8" y1="7" x2="16" y2="7" />
        </svg>
      );
    case "SecureVault":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="11" width="16" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 118 0v3" />
        </svg>
      );
    case "MsgParser":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 8l-4 4 4 4" />
          <path d="M17 8l4 4-4 4" />
          <path d="M14 4l-4 16" />
        </svg>
      );
    case "DshWeb":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11.5 C3 6.8 6.8 4 11 4 C15.2 4 18.6 6.6 20.2 9.8 L23.6 7.6 L22.3 11.2 L23.6 14.8 L20.2 12.6 C18.6 15.8 15.2 18.4 11 18.4 C6.8 18.4 3 15.6 3 11.5 Z" />
          <circle cx="6.6" cy="8.8" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case "Terminal":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2.5" />
          <path d="M6 9l3.5 3L6 15" />
          <path d="M11.5 15H18" />
        </svg>
      );
    case "WICacheViewer":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="7" ry="3" />
          <path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
        </svg>
      );
    default:
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M12 8v8" />
          <path d="M8 12h8" />
        </svg>
      );
  }
}
