import { useRef, useState } from "react";
import { parseVaultCsv, VAULT_CSV_TEMPLATE } from "./vault.csv";
import type { VaultEntry } from "./vault.types";

interface Props {
  onClose: () => void;
  onImport: (entries: VaultEntry[]) => void;
}

export function CsvImportModal({ onClose, onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState(VAULT_CSV_TEMPLATE);
  const [error, setError] = useState("");
  const [previewCount, setPreviewCount] = useState(0);

  async function handleFileChange(file: File | null) {
    if (!file) return;
    const buf = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buf);
    // Fallback for GBK/ANSI files (common on Chinese Windows)
    if (text.includes("\uFFFD")) {
      try { text = new TextDecoder("gbk").decode(buf); } catch { /* keep utf-8 */ }
    }
    setCsvText(text);
    setError("");
  }

  function handlePreview() {
    try {
      const entries = parseVaultCsv(csvText);
      setPreviewCount(entries.length);
      setError("");
    } catch (err) {
      setPreviewCount(0);
      setError(err instanceof Error ? err.message : "CSV 解析失败");
    }
  }

  function handleImport() {
    try {
      const entries = parseVaultCsv(csvText);
      onImport(entries);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV 导入失败");
    }
  }

  function downloadTemplate() {
    const blob = new Blob([VAULT_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "secure-vault-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="vault-mask" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="vault-modal vault-import-modal">
        <div className="vault-modal-header">
          <h3>CSV 导入</h3>
          <button className="vault-modal-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="vault-modal-body">
          <div className="vault-import-toolbar">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="vault-import-input"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            <button className="vault-btn vault-btn--ghost" onClick={() => inputRef.current?.click()}>
              选择 CSV 文件
            </button>
            <button className="vault-btn vault-btn--ghost" onClick={downloadTemplate}>
              下载模板
            </button>
            <button className="vault-btn vault-btn--ghost" onClick={handlePreview}>
              预览
            </button>
          </div>

          <p className="vault-import-hint">
            支持列：type、name、tags、note、ip、dir、osType、url、account、password、customFields。
            多个标签用竖线分隔（如 prod|linux），customFields 使用 JSON 数组。
          </p>

          <textarea
            className="vault-form-input vault-import-textarea"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            spellCheck={false}
          />

          {error && <div className="vault-unlock-error vault-import-error">{error}</div>}
          {!error && previewCount > 0 && (
            <div className="vault-import-preview">可导入 {previewCount} 条记录</div>
          )}

          <div className="vault-modal-footer">
            <button type="button" className="vault-btn vault-btn--ghost" onClick={onClose}>取消</button>
            <button type="button" className="vault-btn vault-btn--primary" onClick={handleImport}>导入</button>
          </div>
        </div>
      </div>
    </div>
  );
}