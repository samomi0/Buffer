import { useState, useRef, useEffect } from "react";

interface Props {
  onUnlock: (password: string) => Promise<void>;
  onBack: () => void;
  error: string;
  isNew: boolean;
}

export function MasterPasswordModal({ onUnlock, onBack, error, isNew }: Props) {
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pwd.trim()) return;
    setLoading(true);
    await onUnlock(pwd);
    setLoading(false);
  }

  return (
    <div className="vault-mask">
      <div className="vault-unlock-card">
        <button className="vault-unlock-back" onClick={onBack} title="返回启动器">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="vault-unlock-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 className="vault-unlock-title">密库</h2>
        <p className="vault-unlock-desc">
          {isNew ? "首次使用，请设置主密码" : "请输入主密码以解锁"}
        </p>
        <form className="vault-unlock-form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="password"
            className="vault-unlock-input"
            placeholder="主密码"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            autoComplete="current-password"
          />
          {error && <p className="vault-unlock-error">{error}</p>}
          <button
            type="submit"
            className="vault-unlock-btn"
            disabled={loading || !pwd.trim()}
          >
            {loading ? "解锁中…" : isNew ? "创建密库" : "解锁"}
          </button>
        </form>
      </div>
    </div>
  );
}
