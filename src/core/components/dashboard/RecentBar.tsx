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
    case "Browser":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
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
