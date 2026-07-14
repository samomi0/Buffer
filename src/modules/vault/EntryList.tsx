import { useState, useCallback } from "react";
import type { VaultEntry } from "./vault.types";

interface Props {
  entries: VaultEntry[];
  selected: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onImport: () => void;
  onChangePassword: () => void;
  onLock: () => void;
  saving?: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  server: "服务器",
  password: "密码",
  custom: "自定义",
};

const TYPE_COLOR: Record<string, string> = {
  server: "var(--accent)",
  password: "var(--success)",
  custom: "var(--warning)",
};

const CAPSULE_PALETTE = [
  { bg: "rgba(37,99,235,.08)", text: "#1d4ed8" },
  { bg: "rgba(22,163,74,.08)", text: "#15803d" },
  { bg: "rgba(124,58,237,.08)", text: "#7c3aed" },
  { bg: "rgba(234,88,12,.08)", text: "#ea580c" },
  { bg: "rgba(219,39,119,.08)", text: "#db2777" },
  { bg: "rgba(13,148,136,.08)", text: "#0f766e" },
  { bg: "rgba(79,70,229,.08)", text: "#4f46e5" },
  { bg: "rgba(180,83,9,.08)", text: "#b45309" },
  { bg: "rgba(2,132,199,.08)", text: "#0369a1" },
  { bg: "rgba(202,138,4,.08)", text: "#a16207" },
  { bg: "rgba(190,24,93,.08)", text: "#9d174d" },
  { bg: "rgba(5,150,105,.08)", text: "#047857" },
];

function capsuleColor(key: string) {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return CAPSULE_PALETTE[Math.abs(hash) % CAPSULE_PALETTE.length];
}

function TagIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

export function EntryList({
  entries,
  selected,
  searchQuery,
  onSearchChange,
  onSelect,
  onNew,
  onImport,
  onChangePassword,
  onLock,
  saving,
}: Props) {
  const [toast, setToast] = useState<string | null>(null);

  const handleCopy = useCallback((text: string, label: string, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    navigator.clipboard.writeText(text);
    setToast(label);
    setTimeout(() => setToast(null), 1500);
  }, []);

  return (
    <div className="vault-list-panel">
      <div className="vault-list-header">
        <div className="vault-search-wrap">
          <svg className="vault-search-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            className="vault-search-input"
            placeholder="搜索…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <button className="vault-new-btn" onClick={onNew} title="新增条目">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button className="vault-import-btn" onClick={onImport} title="CSV 导入">
          CSV
        </button>
        <button className="vault-action-btn" onClick={onChangePassword} title="修改主密码">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </button>
        <button className="vault-action-btn" onClick={onLock} title="锁定密库">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </button>
        {saving && <span className="vault-saving">保存中…</span>}
      </div>

      <div className="vault-entry-list">
        {entries.length === 0 && (
          <div className="vault-list-empty">
            {searchQuery ? "无匹配结果" : "暂无条目，点击 + 新增"}
          </div>
        )}
        <div className="vault-entry-grid">
        {entries.map((e) => (
          <article
            key={e.id}
            className={`vault-entry-card ${selected === e.id ? "active" : ""}`}
            onClick={() => onSelect(e.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(e.id);
              }
            }}
          >
            {/* top bar — type + tag icon + tag */}
            <div
              className="vault-card-bar"
              style={{ borderLeftColor: TYPE_COLOR[e.type] }}
            >
              <span className="vault-card-bar-type" style={{ color: TYPE_COLOR[e.type] }}>
                {TYPE_LABEL[e.type]}
              </span>
              <span className="vault-card-bar-tag">
                <TagIcon />
                {e.tags.length > 0 ? (
                  <span className="vault-card-tag-list">
                    {e.tags.map((t) => (
                      <span key={t} className="vault-card-tag-pill">{t}</span>
                    ))}
                  </span>
                ) : "无标签"}
              </span>
            </div>

            {/* body — name + key capsules */}
            <div className="vault-card-body">
              <div className="vault-entry-name">{e.name}</div>
              <div className="vault-card-capsules">
                {e.type === "server" && (
                  <>
                    {e.ip && (() => { const c = capsuleColor("IP"); return (
                      <span
                        className="vault-capsule"
                        style={{ color: c.text, background: c.bg }}
                        onClick={(ev) => handleCopy(e.ip!, "IP", ev)}
                        onContextMenu={(ev) => handleCopy(e.ip!, "IP", ev)}
                        title="左键/右键复制"
                      >
                        IP: {e.ip}
                      </span>
                    );})()}
                    {e.dir && (() => { const c = capsuleColor("目录"); return (
                      <span
                        className="vault-capsule"
                        style={{ color: c.text, background: c.bg }}
                        onClick={(ev) => handleCopy(e.dir!, "目录", ev)}
                        onContextMenu={(ev) => handleCopy(e.dir!, "目录", ev)}
                        title="左键/右键复制"
                      >
                        目录: {e.dir}
                      </span>
                    );})()}
                  </>
                )}
                {e.type === "password" && (
                  <>
                    {e.account && (() => { const c = capsuleColor("账号"); return (
                      <span
                        className="vault-capsule"
                        style={{ color: c.text, background: c.bg }}
                        onClick={(ev) => handleCopy(e.account!, "账号", ev)}
                        onContextMenu={(ev) => handleCopy(e.account!, "账号", ev)}
                        title="左键/右键复制"
                      >
                        账号: {e.account}
                      </span>
                    );})()}
                    {e.url && (() => { const c = capsuleColor("地址"); return (
                      <span
                        className="vault-capsule"
                        style={{ color: c.text, background: c.bg }}
                        onClick={(ev) => handleCopy(e.url!, "地址", ev)}
                        onContextMenu={(ev) => handleCopy(e.url!, "地址", ev)}
                        title="左键/右键复制"
                      >
                        地址: {e.url}
                      </span>
                    );})()}
                    {e.password && (() => { const c = capsuleColor("密码"); return (
                      <span
                        className="vault-capsule vault-capsule--secret"
                        style={{ color: c.text, background: c.bg }}
                        onClick={(ev) => handleCopy(e.password!, "密码", ev)}
                        onContextMenu={(ev) => handleCopy(e.password!, "密码", ev)}
                        title="左键/右键复制"
                      >
                        密码: ••••••••
                      </span>
                    );})()}
                  </>
                )}
                {e.type === "custom" && (e.fields ?? []).length > 0 && (() => {
                  const keyFields = (e.fields ?? []).filter((f) => f.keyField);
                  const display = keyFields.length > 0 ? keyFields : (e.fields ?? []);
                  return (
                    <>
                      {display.slice(0, 4).map((f) => {
                        const c = capsuleColor(f.key);
                        return (
                          <span
                            key={f.key}
                            className={`vault-capsule ${f.secret ? "vault-capsule--secret" : ""}`}
                            style={{ color: c.text, background: c.bg }}
                            onClick={(ev) => handleCopy(f.value, f.key, ev)}
                            onContextMenu={(ev) => handleCopy(f.value, f.key, ev)}
                            title="左键/右键复制"
                          >
                            {f.key}: {f.secret ? "••••••••" : f.value || "—"}
                          </span>
                        );
                      })}
                      {display.length > 4 && (
                        <span className="vault-capsule vault-capsule--more">+{display.length - 4} 项</span>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </article>
        ))}
        </div>
      </div>
      {toast && (
        <div className="vault-copy-toast">已复制 {toast}</div>
      )}
    </div>
  );
}
