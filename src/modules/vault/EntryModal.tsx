import { useState, useEffect } from "react";
import type { VaultEntry, VaultData, CustomField, EntryType } from "./vault.types";

interface Props {
  entry: VaultEntry | null;
  vaultData: VaultData;
  onSave: (entry: VaultEntry) => void;
  onClose: () => void;
}

function newEntry(): VaultEntry {
  return {
    id: crypto.randomUUID(),
    type: "password",
    name: "",
    tags: [],
    note: "",
    ip: "",
    dir: "",
    osType: "",
    url: "",
    account: "",
    password: "",
    fields: [],
  };
}

const TYPE_OPTIONS: { value: EntryType; label: string }[] = [
  { value: "server", label: "服务器" },
  { value: "password", label: "密码" },
  { value: "custom", label: "自定义" },
];

export function EntryModal({ entry, vaultData, onSave, onClose }: Props) {
  const [form, setForm] = useState<VaultEntry>(() =>
    entry ? { ...entry, fields: entry.fields ? [...entry.fields.map((f) => ({ ...f }))] : [] } : newEntry()
  );
  const [tagInput, setTagInput] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function setField<K extends keyof VaultEntry>(key: K, val: VaultEntry[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t || form.tags.includes(t)) { setTagInput(""); return; }
    setField("tags", [...form.tags, t]);
    setTagInput("");
  }

  function removeTag(t: string) {
    setField("tags", form.tags.filter((x) => x !== t));
  }

  function addField() {
    setField("fields", [...(form.fields ?? []), { key: "", value: "", secret: false, keyField: false }]);
  }

  function updateField(i: number, patch: Partial<CustomField>) {
    const fields = [...(form.fields ?? [])];
    fields[i] = { ...fields[i], ...patch };
    setField("fields", fields);
  }

  function removeField(i: number) {
    setField("fields", (form.fields ?? []).filter((_, idx) => idx !== i));
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({ ...form, name: form.name.trim() });
  }

  return (
    <div className="vault-mask" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="vault-modal">
        <div className="vault-modal-header">
          <h3>{entry ? "编辑条目" : "新增条目"}</h3>
          <button className="vault-modal-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form className="vault-modal-body" onSubmit={handleSave}>
          {/* 类型选择 */}
          <div className="vault-form-row">
            <label className="vault-form-label">类型</label>
            <div className="vault-type-tabs">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`vault-type-tab ${form.type === opt.value ? "active" : ""}`}
                  onClick={() => setField("type", opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 名称 */}
          <div className="vault-form-row">
            <label className="vault-form-label">名称 *</label>
            <input
              className="vault-form-input"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="条目名称"
              required
              autoFocus
            />
          </div>

          {/* 服务器字段 */}
          {form.type === "server" && (
            <>
              <div className="vault-form-row">
                <label className="vault-form-label">IP</label>
                <input className="vault-form-input" value={form.ip ?? ""} onChange={(e) => setField("ip", e.target.value)} placeholder="192.168.1.1" />
              </div>
              <div className="vault-form-row">
                <label className="vault-form-label">目录</label>
                <input className="vault-form-input" value={form.dir ?? ""} onChange={(e) => setField("dir", e.target.value)} placeholder="/data/app" />
              </div>
              <div className="vault-form-row">
                <label className="vault-form-label">系统类型</label>
                <input className="vault-form-input" value={form.osType ?? ""} onChange={(e) => setField("osType", e.target.value)} placeholder="Linux / Windows" />
              </div>
            </>
          )}

          {/* 密码字段 */}
          {form.type === "password" && (
            <>
              <div className="vault-form-row">
                <label className="vault-form-label">地址</label>
                <input className="vault-form-input" value={form.url ?? ""} onChange={(e) => setField("url", e.target.value)} placeholder="https://example.com" />
              </div>
              <div className="vault-form-row">
                <label className="vault-form-label">账号</label>
                <input className="vault-form-input" value={form.account ?? ""} onChange={(e) => setField("account", e.target.value)} placeholder="用户名 / 邮箱" />
              </div>
              <div className="vault-form-row">
                <label className="vault-form-label">密码</label>
                <div className="vault-pwd-wrap">
                  <input
                    className="vault-form-input"
                    type={showPwd ? "text" : "password"}
                    value={form.password ?? ""}
                    onChange={(e) => setField("password", e.target.value)}
                    placeholder="密码"
                    autoComplete="new-password"
                  />
                  <button type="button" className="vault-pwd-toggle" onClick={() => setShowPwd((v) => !v)}>
                    {showPwd ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* 自定义字段 */}
          {form.type === "custom" && (
            <div className="vault-form-row vault-form-row--col">
              <div className="vault-form-label-row">
                <label className="vault-form-label">自定义字段</label>
                <button type="button" className="vault-field-add-btn" onClick={addField}>+ 添加字段</button>
              </div>
              {(form.fields ?? []).length === 0 && (
                <p className="vault-fields-empty">暂无字段</p>
              )}
              {(form.fields ?? []).map((f, i) => (
                <div key={i} className="vault-custom-field-row">
                  <input
                    className="vault-form-input vault-cf-key"
                    placeholder="字段名"
                    value={f.key}
                    onChange={(e) => updateField(i, { key: e.target.value })}
                  />
                  <input
                    className="vault-form-input vault-cf-val"
                    placeholder="值"
                    type={f.secret ? "password" : "text"}
                    value={f.value}
                    onChange={(e) => updateField(i, { value: e.target.value })}
                  />
                  <label className="vault-cf-keyfield" title="标记为关键信息（展示在卡片上）">
                    <input
                      type="checkbox"
                      checked={Boolean(f.keyField)}
                      onChange={(e) => updateField(i, { keyField: e.target.checked })}
                    />
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </label>
                  <label className="vault-cf-secret" title="标记为隐私字段（隐藏值）">
                    <input
                      type="checkbox"
                      checked={f.secret}
                      onChange={(e) => updateField(i, { secret: e.target.checked })}
                    />
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </label>
                  <button type="button" className="vault-cf-del" onClick={() => removeField(i)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 备注 */}
          <div className="vault-form-row">
            <label className="vault-form-label">备注</label>
            <textarea
              className="vault-form-input vault-form-textarea"
              value={form.note}
              onChange={(e) => setField("note", e.target.value)}
              placeholder="备注信息"
              rows={2}
            />
          </div>

          {/* 标签 */}
          <div className="vault-form-row vault-form-row--col">
            <label className="vault-form-label">标签</label>
            <div className="vault-tag-editor">
              {form.tags.map((t) => (
                <span key={t} className="vault-entry-tag vault-tag-removable">
                  {t}
                  <button type="button" onClick={() => removeTag(t)}>×</button>
                </span>
              ))}
              <input
                className="vault-tag-input"
                placeholder={`输入标签后回车${vaultData.tags.length > 0 ? "（已有：" + vaultData.tags.slice(0, 3).join("、") + "）" : ""}`}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                list="vault-tag-list"
              />
              <datalist id="vault-tag-list">
                {vaultData.tags.filter((t) => !form.tags.includes(t)).map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="vault-modal-footer">
            <button type="button" className="vault-btn vault-btn--ghost" onClick={onClose}>取消</button>
            <button type="submit" className="vault-btn vault-btn--primary" disabled={!form.name.trim()}>保存</button>
          </div>
        </form>
      </div>
    </div>
  );
}
