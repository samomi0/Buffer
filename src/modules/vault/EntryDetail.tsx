import { useEffect, useState } from "react";
import type { VaultEntry } from "./vault.types";

interface Props {
  entry: VaultEntry | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFilterTag: (tag: string) => void;
  onRecordUsage?: (id: string) => void;
}

function SecretField({ value, onCopy }: { value: string; onCopy?: () => void }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <span className="vault-secret-field">
      <span className="vault-secret-value">
        {visible ? value : "••••••••"}
      </span>
      <button
        className="vault-secret-btn"
        onClick={() => setVisible((v) => !v)}
        title={visible ? "隐藏" : "显示"}
      >
        {visible ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
      <button className="vault-secret-btn" onClick={copy} title="复制">
        {copied ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </span>
  );
}

function CopyableValue({ label, value, onCopy }: { label: string; value: string; onCopy?: () => void }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <span className="vault-copyable-value">
      <span className="vault-detail-value">{value}</span>
      <button className="vault-copy-btn" onClick={copy} title={`复制 ${label}`}>
        {copied ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </span>
  );
}

function Field({ label, value, secret, onCopy }: { label: string; value: string; secret?: boolean; onCopy?: () => void }) {
  if (!value) return null;
  return (
    <div className="vault-detail-field">
      <span className="vault-detail-label">{label}</span>
      {secret ? (
        <SecretField value={value} onCopy={onCopy} />
      ) : (
        <CopyableValue label={label} value={value} onCopy={onCopy} />
      )}
    </div>
  );
}

const TYPE_LABEL: Record<string, string> = {
  server: "服务器",
  password: "密码",
  custom: "自定义",
};

export function EntryDetail({ entry, onClose, onEdit, onDelete, onFilterTag, onRecordUsage }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setConfirmDelete(false);
  }, [entry?.id]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!entry) {
    return null;
  }

  const handleCopyField = () => {
    onRecordUsage?.(entry.id);
  };

  return (
    <div
      className="vault-mask vault-detail-mask"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="vault-detail-panel" onClick={(event) => event.stopPropagation()}>
        <div className="vault-detail-header">
          <div className="vault-detail-title-wrap">
            <span className="vault-detail-type">{TYPE_LABEL[entry.type]}</span>
            <h3 className="vault-detail-name">{entry.name}</h3>
          </div>
          <div className="vault-detail-actions">
            <button className="vault-action-btn" onClick={onEdit} title="编辑">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            {!confirmDelete ? (
              <button
                className="vault-action-btn danger"
                onClick={() => setConfirmDelete(true)}
                title="删除"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
              </button>
            ) : (
              <div className="vault-confirm-delete">
                <span>确认删除？</span>
                <button className="vault-confirm-yes" onClick={onDelete}>删除</button>
                <button className="vault-confirm-no" onClick={() => setConfirmDelete(false)}>取消</button>
              </div>
            )}
            <button className="vault-action-btn" onClick={onClose} title="关闭">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="vault-detail-body">
          {entry.type === "server" && (
            <>
              <Field label="IP 地址" value={entry.ip ?? ""} onCopy={handleCopyField} />
              <Field label="目录" value={entry.dir ?? ""} onCopy={handleCopyField} />
              <Field label="系统类型" value={entry.osType ?? ""} onCopy={handleCopyField} />
            </>
          )}
          {entry.type === "password" && (
            <>
              <Field label="地址" value={entry.url ?? ""} onCopy={handleCopyField} />
              <Field label="账号" value={entry.account ?? ""} onCopy={handleCopyField} />
              <Field label="密码" value={entry.password ?? ""} secret onCopy={handleCopyField} />
            </>
          )}
          {entry.type === "custom" && entry.fields && entry.fields.length > 0 && (
            <>
              {entry.fields.map((f, i) => (
                <Field key={i} label={f.key} value={f.value} secret={f.secret} onCopy={handleCopyField} />
              ))}
            </>
          )}
          {entry.note && <Field label="备注" value={entry.note} onCopy={handleCopyField} />}
          {entry.tags.length > 0 && (
            <div className="vault-detail-field">
              <span className="vault-detail-label">标签</span>
              <span className="vault-detail-tags">
                {entry.tags.map((t) => (
                  <button key={t} className="vault-entry-tag vault-entry-tag-btn" onClick={() => onFilterTag(t)}>{t}</button>
                ))}
              </span>
            </div>
          )}
        </div>
        <div className="vault-detail-footer">
          <span>左键空白处关闭，右键任意位置快速关闭</span>
          {typeof entry.usageCount === "number" && entry.usageCount > 0 && (
            <span className="vault-detail-usage">已复制 {entry.usageCount} 次</span>
          )}
        </div>
      </div>
    </div>
  );
}
