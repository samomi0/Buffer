import { useWindowChrome } from "./windowChrome";
import { WindowControls } from "./WindowControls";
import "./WindowBar.css";

/**
 * 极简窗口条：用于没有主工具栏的阶段（启动加载页、首次设置页），
 * 保证无边框窗口在这些阶段仍可拖动 / 最小化 / 最大化 / 关闭。
 */
export function WindowBar() {
  const { onTitlebarMouseDown } = useWindowChrome();

  return (
    <header className="window-bar" onMouseDown={onTitlebarMouseDown}>
      <span className="window-bar-brand">Buffer</span>
      <span className="window-bar-grow" />
      <WindowControls />
    </header>
  );
}
