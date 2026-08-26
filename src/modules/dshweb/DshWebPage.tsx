import { useEffect } from "react";
import { useAppStore } from "../../core/stores/appStore";
import "./DshWebPage.css";

/**
 * DeepSeek Harness Web 页签：直接内嵌访问设置中配置的前端地址，
 * 不提供任何状态栏或按钮，保持页面清爽。启停与更新请使用「终端」。
 */
export function DshWebPage() {
  const closeTool = useAppStore((s) => s.closeTool);
  const dshConfig = useAppStore((s) => s.dshConfig);

  const url = dshConfig.webUrl || "http://127.0.0.1:3080";

  /* ── Ctrl+K 返回 ─────────────────────────────────────────── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        closeTool();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeTool]);

  return (
    <div className="dshweb-shell">
      <iframe
        key={url}
        src={url}
        className="dshweb-frame"
        title="DeepSeek Harness Web"
      />
    </div>
  );
}
