import { useWindowChrome } from "./windowChrome";
import "./WindowControls.css";

/**
 * 最小化 / 最大化(还原) / 关闭 窗口按钮组（现代圆角风格）。
 * 仅运行于 Tauri 环境时渲染；浏览器预览下返回 null。
 */
export function WindowControls() {
  const { isTauri, isMaximized, minimize, toggleMaximize, close } =
    useWindowChrome();

  if (!isTauri) return null;

  return (
    <div className="window-controls" aria-label="窗口控制">
      <button
        type="button"
        className="window-control-btn"
        onClick={minimize}
        title="最小化"
        aria-label="最小化"
      >
        <MinimizeIcon />
      </button>
      <button
        type="button"
        className="window-control-btn"
        onClick={toggleMaximize}
        title={isMaximized ? "还原" : "最大化"}
        aria-label={isMaximized ? "还原" : "最大化"}
      >
        {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
      </button>
      <button
        type="button"
        className="window-control-btn close"
        onClick={close}
        title="关闭"
        aria-label="关闭"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function MinimizeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="5" width="14" height="14" rx="1.5" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="8.5" y="8.5" width="11" height="11" rx="1.5" />
      <path d="M5.5 15.5V6.5A1.5 1.5 0 0 1 7 5h9" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
