import { useState } from "react";
import { termDetectShell } from "../../../modules/terminal/terminal";
import "./IntegrationSettings.css";

interface SaveProps {
  onSave: (next: Record<string, unknown>) => void;
}

/** DeepSeek Harness Web 前端地址配置 */
export function DshWebSettingsPanel({
  webUrl,
  onSave,
}: SaveProps & { webUrl: string }) {
  const [draft, setDraft] = useState(webUrl);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave({ webUrl: draft.trim() || "http://127.0.0.1:3080" });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <section className="settings-panel">
      <div className="settings-panel-head compact">
        <div>
          <h2>DeepSeek Harness Web</h2>
          <p>「Harness Web」页签直接内嵌访问该地址，启停与更新请在「终端」中操作。</p>
        </div>
      </div>

      <div className="settings-field-card">
        <span className="settings-field-label">前端地址</span>
        <div className="settings-field-row">
          <input
            className="settings-open-cmd-input"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="http://127.0.0.1:3080"
          />
          <button className="settings-btn" onClick={handleSave}>
            {saved ? "已保存" : "保存"}
          </button>
        </div>
        <p className="settings-inline-message">
          例如终端中执行 <code>dsh web --no-open</code> 后，默认地址为{" "}
          <code>http://127.0.0.1:3080</code>。
        </p>
      </div>
    </section>
  );
}

/** 终端配置 */
export function TerminalSettingsPanel({
  shellPath,
  cwd,
  onSave,
}: SaveProps & { shellPath: string; cwd: string }) {
  const [shellDraft, setShellDraft] = useState(shellPath);
  const [cwdDraft, setCwdDraft] = useState(cwd);
  const [saved, setSaved] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const persist = (next: { shellPath?: string; cwd?: string }) => {
    onSave(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const path = await termDetectShell();
      if (path) {
        setShellDraft(path);
        persist({ shellPath: path, cwd: cwdDraft.trim() || undefined });
      }
    } finally {
      setDetecting(false);
    }
  };

  return (
    <section className="settings-panel">
      <div className="settings-panel-head compact">
        <div>
          <h2>终端</h2>
          <p>「终端」页签默认使用 bash.exe，可在此配置自定义终端。</p>
        </div>
      </div>

      <div className="settings-field-card">
        <span className="settings-field-label">终端可执行文件</span>
        <div className="settings-field-row">
          <input
            className="settings-open-cmd-input"
            type="text"
            value={shellDraft}
            onChange={(e) => setShellDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && persist({ shellPath: shellDraft.trim(), cwd: cwdDraft.trim() || undefined })}
            placeholder="留空自动检测 bash.exe"
          />
          <button className="settings-btn settings-btn-ghost" onClick={() => void handleDetect()} disabled={detecting}>
            {detecting ? "检测中..." : "自动检测"}
          </button>
        </div>

        <span className="settings-field-label" style={{ marginTop: 10 }}>工作目录</span>
        <div className="settings-field-row">
          <input
            className="settings-open-cmd-input"
            type="text"
            value={cwdDraft}
            onChange={(e) => setCwdDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && persist({ shellPath: shellDraft.trim() || undefined, cwd: cwdDraft.trim() || undefined })}
            placeholder="留空使用用户主目录"
          />
        </div>

        <div className="settings-field-row" style={{ marginTop: 10 }}>
          <button
            className="settings-btn"
            onClick={() => persist({ shellPath: shellDraft.trim() || undefined, cwd: cwdDraft.trim() || undefined })}
          >
            {saved ? "已保存" : "保存"}
          </button>
        </div>
      </div>
    </section>
  );
}
