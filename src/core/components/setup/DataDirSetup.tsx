import { useState } from "react";
import "./DataDirSetup.css";

interface Props {
  onComplete: (dir: string) => void;
}

export function DataDirSetup({ onComplete }: Props) {
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async () => {
    setSelecting(true);
    setError(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const dir: string | null = await invoke("select_data_dir");
      if (dir) {
        onComplete(dir);
      } else {
        setError("未选择目录");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSelecting(false);
    }
  };

  return (
    <div className="setup-shell">
      <div className="setup-card">
        <div className="setup-icon">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="2" width="20" height="20" rx="4" />
            <path d="M7 8h10M7 12h10M7 16h6" />
          </svg>
        </div>

        <h1 className="setup-title">Buffer</h1>

        <p className="setup-desc">
          首次使用，请选择数据存储目录
        </p>

        <button
          className="setup-btn"
          onClick={handleSelect}
          disabled={selecting}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          </svg>
          {selecting ? "选择中..." : "选择目录"}
        </button>

        {error && <p className="setup-error">{error}</p>}

        <p className="setup-hint">
          数据仅存储在本地，后续可在设置中修改目录
        </p>
      </div>
    </div>
  );
}
