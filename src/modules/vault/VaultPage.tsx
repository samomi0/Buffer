import { useState, useCallback, useMemo, useEffect } from "react";
import { useAppStore } from "../../core/stores/appStore";
import { MasterPasswordModal } from "./MasterPasswordModal";
import { TagSidebar } from "./TagSidebar";
import { EntryList } from "./EntryList";
import { EntryDetail } from "./EntryDetail";
import { EntryModal } from "./EntryModal";
import { CsvImportModal } from "./CsvImportModal";
import { deriveKey, encryptVault, decryptVault, readEnvelopeIterations } from "./vault.crypto";
import type { VaultData, VaultEntry, EntryType } from "./vault.types";
import { EMPTY_VAULT } from "./vault.types";
import "./VaultPage.css";

type InitPhase = "loading" | "lock-screen" | "first-time" | "ready";

const PWD_KEY = "vault-master-password";

function parseSearchTokens(query: string) {
  const tagMatches = Array.from(query.matchAll(/#([^\s#]+)/g)).map((match) => match[1].trim());
  const text = query.replace(/#([^\s#]+)/g, " ").replace(/\s+/g, " ").trim();
  return { tags: tagMatches, text };
}

function readStoredPassword(): string | null {
  try {
    const val = sessionStorage.getItem(PWD_KEY) ?? localStorage.getItem(PWD_KEY);
    // 空字符串无法用于解密，等同无密码
    return val || null;
  }
  catch { return null; }
}

function savePassword(pwd: string) {
  try {
    sessionStorage.setItem(PWD_KEY, pwd);
    localStorage.setItem(PWD_KEY, pwd);
  } catch { /* ignore */ }
}

function clearPassword() {
  try {
    sessionStorage.removeItem(PWD_KEY);
    localStorage.removeItem(PWD_KEY);
  } catch { /* ignore */ }
}

export function VaultPage() {
  const closeTool = useAppStore((s) => s.closeTool);
  const dataDir = useAppStore((s) => s.dataDir);

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

  const [initPhase, setInitPhase] = useState<InitPhase>("loading");
  const [initError, setInitError] = useState("");
  // 标记文件中是否已有数据，用于区分「首次创建」和「重新输入密码」
  const [hasExistingData, setHasExistingData] = useState(false);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [vault, setVault] = useState<VaultData>(EMPTY_VAULT);
  const [saving, setSaving] = useState(false);
  const [showPwdChange, setShowPwdChange] = useState(false);
  const [newPwd, setNewPwd] = useState("");

  const [tagFilters, setTagFilters] = useState<Record<string, "include" | "exclude">>({});
  const [pinnedTags, setPinnedTags] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("vault-pinned-tags") ?? "[]"); }
    catch { return []; }
  });
  const [selectedType, setSelectedType] = useState<EntryType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<VaultEntry | null | "new">(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const searchTokens = useMemo(() => parseSearchTokens(searchQuery), [searchQuery]);

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const cipher: string = await invoke("read_vault_file", { dataDir: dataDir! });

        if (!cipher.trim()) {
          // Empty file → first-time setup
          setInitPhase("first-time");
          setHasExistingData(false);
          return;
        }

        // 文件有数据
        setHasExistingData(true);

        // 从信封中读取加密时使用的迭代次数
        const iterations = readEnvelopeIterations(cipher);

        // Try stored password
        const stored = readStoredPassword();
        if (stored) {
          const key = await deriveKey(stored, iterations);
          try {
            const data = await decryptVault(cipher, key);
            setCryptoKey(key);
            setVault(data);
            setInitPhase("ready");
            return;
          } catch (err) {
            console.warn("[VaultPage] 存储密码解密失败：", String(err));
            // stored password wrong, fall through to lock-screen
          }
        }

        // No usable password → show lock screen
        setInitPhase("lock-screen");
      } catch {
        setInitError("读取密库文件失败");
        setInitPhase("first-time");
      }
    }
    init();
  }, [dataDir]);

  // ── First-time / unlock ──────────────────────────────────────────────────
  async function handleSetPassword(password: string) {
    setInitError("");
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const cipher: string = await invoke("read_vault_file", { dataDir: dataDir! });
      // 从信封中读取加密时使用的迭代次数
      const iterations = cipher.trim() ? readEnvelopeIterations(cipher) : undefined;
      const key = await deriveKey(password, iterations);

      if (!cipher.trim()) {
        // New vault — 文件为空
        savePassword(password);
        setCryptoKey(key);
        setVault(EMPTY_VAULT);
        setHasExistingData(false);
        setInitPhase("ready");
      } else {
        // Existing vault — try to decrypt
        const data = await decryptVault(cipher, key);
        savePassword(password);
        setCryptoKey(key);
        setVault(data);
        setHasExistingData(true);
        setInitPhase("ready");
      }
    } catch (err) {
      const msg = String(err);
      if (msg.includes("InvalidCharacterError") || msg.includes("base64")) {
        setInitError(`密库文件损坏：Base64 解码失败（${msg.slice(0, 60)}）`);
      } else if (msg.includes("Unexpected token") || msg.includes("不是有效的 JSON")) {
        setInitError(`密库文件损坏：JSON 解析失败（${msg.slice(0, 60)}）`);
      } else if (msg.includes("OperationError")) {
        setInitError("密码错误：AES-GCM 解密失败，请检查密码是否正确");
      } else {
        setInitError(`${msg.slice(0, 120)}`);
      }
    }
  }

  // ── Change password ──────────────────────────────────────────────────────
  async function handleChangePassword() {
    if (!newPwd.trim() || !cryptoKey) return;
    const key = await deriveKey(newPwd.trim());
    // Re-encrypt current data with new key
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const cipher = await encryptVault(vault, key);
      await invoke("write_vault_file", { dataDir: dataDir!, content: cipher });
      savePassword(newPwd.trim());
      setCryptoKey(key);
      setShowPwdChange(false);
      setNewPwd("");
    } catch {
      setInitError("修改密码失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  // ── Persist ──────────────────────────────────────────────────────────────
  const persist = useCallback(
    async (data: VaultData, key: CryptoKey) => {
      setSaving(true);
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const cipher = await encryptVault(data, key);
        // write_vault_file 内部已使用原子写入（临时文件+重命名）
        await invoke("write_vault_file", { dataDir: dataDir!, content: cipher });
      } finally {
        setSaving(false);
      }
    },
    [dataDir]
  );

  // ── Entry CRUD ───────────────────────────────────────────────────────────
  async function handleSaveEntry(entry: VaultEntry) {
    const newEntries = vault.entries.find((e) => e.id === entry.id)
      ? vault.entries.map((e) => (e.id === entry.id ? entry : e))
      : [entry, ...vault.entries];

    // Sync global tags
    const allTags = Array.from(new Set([...vault.tags, ...entry.tags]));
    const newVault: VaultData = { entries: newEntries, tags: allTags };
    setVault(newVault);
    setSelectedId(entry.id);
    setEditingEntry(null);
    await persist(newVault, cryptoKey!);
  }

  async function handleDeleteEntry() {
    if (!selectedId) return;
    const newEntries = vault.entries.filter((e) => e.id !== selectedId);
    const usedTags = new Set(newEntries.flatMap((e) => e.tags));
    const newVault: VaultData = { entries: newEntries, tags: vault.tags.filter((t) => usedTags.has(t)) };
    setVault(newVault);
    setSelectedId(null);
    await persist(newVault, cryptoKey!);
  }

  async function handleImportEntries(entries: VaultEntry[]) {
    const mergedEntries = [...entries, ...vault.entries];
    const allTags = Array.from(new Set(mergedEntries.flatMap((entry) => entry.tags)));
    const newVault: VaultData = { entries: mergedEntries, tags: allTags };
    setVault(newVault);
    setSelectedId(entries[0]?.id ?? null);
    await persist(newVault, cryptoKey!);
  }

  function handleTagFilterChange(tag: string) {
    setTagFilters((prev) => {
      const cur = prev[tag];
      const next = { ...prev };
      if (cur === undefined) next[tag] = "include";
      else if (cur === "include") next[tag] = "exclude";
      else delete next[tag];
      return next;
    });
  }

  function handleResetTagFilters() {
    setTagFilters({});
  }

  // ── Filtered entries ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = vault.entries;
    if (selectedType) {
      list = list.filter((e) => e.type === selectedType);
    }

    // include/exclude tag filters from sidebar
    const includeFromFilters = Object.entries(tagFilters)
      .filter(([, s]) => s === "include").map(([t]) => t);
    const excludeFromFilters = Object.entries(tagFilters)
      .filter(([, s]) => s === "exclude").map(([t]) => t);
    // search bar tags are always "include" additions
    const searchTags = searchTokens.tags;

    if (includeFromFilters.length > 0 || excludeFromFilters.length > 0 || searchTags.length > 0) {
      list = list.filter((e) => {
        for (const tag of excludeFromFilters) {
          if (e.tags.includes(tag)) return false;
        }
        if (includeFromFilters.length > 0 && !includeFromFilters.some((tag) => e.tags.includes(tag))) return false;
        if (searchTags.length > 0 && !searchTags.some((tag) => e.tags.includes(tag))) return false;
        return true;
      });
    }

    if (searchTokens.text.trim()) {
      const q = searchTokens.text.toLowerCase();
      list = list.filter((e) => {
        const haystack = [
          e.name, e.note, e.ip, e.dir, e.osType,
          e.url, e.account, ...e.tags,
          ...(e.fields ?? []).map((f) => f.key + " " + f.value),
        ].join(" ").toLowerCase();
        return haystack.includes(q);
      });
    }
    return list;
  }, [vault.entries, selectedType, tagFilters, searchTokens]);

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    vault.entries.forEach((e) => e.tags.forEach((t) => { counts[t] = (counts[t] ?? 0) + 1; }));
    return counts;
  }, [vault.entries]);

  const typeCounts = useMemo(() => {
    const counts: Record<EntryType, number> = { server: 0, password: 0, custom: 0 };
    vault.entries.forEach((e) => { counts[e.type] = (counts[e.type] ?? 0) + 1; });
    return counts;
  }, [vault.entries]);

  const selectedEntry = vault.entries.find((e) => e.id === selectedId) ?? null;

  // ── Render ────────────────────────────────────────────────────────────────
  if (initPhase === "loading") {
    return (
      <div className="vault-page" style={{ alignItems: "center", justifyContent: "center" }}>
        <span className="loading-pulse">加载密库…</span>
      </div>
    );
  }

  if (initPhase === "first-time" || initPhase === "lock-screen") {
    return (
      <MasterPasswordModal
        onUnlock={handleSetPassword}
        onBack={closeTool}
        error={initError}
        isNew={initPhase === "first-time"}
      />
    );
  }

  return (
    <div className="vault-page">
      {/* Body */}
      <div className="vault-body">
        <TagSidebar
          tags={vault.tags}
          tagFilters={tagFilters}
          selectedType={selectedType}
          pinnedTags={pinnedTags}
          counts={tagCounts}
          typeCounts={typeCounts}
          total={vault.entries.length}
          onTagFilterChange={handleTagFilterChange}
          onResetTagFilters={handleResetTagFilters}
          onSelectType={setSelectedType}
          onTogglePin={(tag) => {
            const next = pinnedTags.includes(tag)
              ? pinnedTags.filter((t) => t !== tag)
              : [...pinnedTags, tag];
            setPinnedTags(next);
            localStorage.setItem("vault-pinned-tags", JSON.stringify(next));
          }}
        />
        <EntryList
          entries={filtered}
          selected={selectedId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelect={setSelectedId}
          onNew={() => setEditingEntry("new")}
          onImport={() => setShowImportModal(true)}
          onChangePassword={() => { setShowPwdChange(true); setNewPwd(""); }}
          onLock={() => { clearPassword(); setCryptoKey(null); setVault(EMPTY_VAULT); setSelectedId(null); setSearchQuery(""); setTagFilters({}); setSelectedType(null); setPinnedTags([]); setInitPhase("lock-screen"); }}
          saving={saving}
        />
      </div>

      {selectedEntry && (
        <EntryDetail
          entry={selectedEntry}
          onClose={() => setSelectedId(null)}
          onEdit={() => setEditingEntry(selectedEntry)}
          onDelete={handleDeleteEntry}
          onFilterTag={(tag) => handleTagFilterChange(tag)}
        />
      )}

      {/* Modal */}
      {editingEntry !== null && (
        <EntryModal
          entry={editingEntry === "new" ? null : editingEntry}
          vaultData={vault}
          onSave={handleSaveEntry}
          onClose={() => setEditingEntry(null)}
        />
      )}
      {showImportModal && (
        <CsvImportModal
          onClose={() => setShowImportModal(false)}
          onImport={handleImportEntries}
        />
      )}

      {/* Change password dialog */}
      {showPwdChange && (
        <div className="vault-mask" onClick={() => { setShowPwdChange(false); setNewPwd(""); }}>
          <div className="vault-unlock-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="vault-unlock-title">修改主密码</h2>
            <p className="vault-unlock-desc">输入新密码，无需旧密码验证</p>
            <form className="vault-unlock-form" onSubmit={(e) => { e.preventDefault(); handleChangePassword(); }}>
              <input
                type="password"
                className="vault-unlock-input"
                placeholder="新主密码"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                autoFocus
              />
              <div className="vault-modal-footer">
                <button type="button" className="vault-btn vault-btn--ghost" onClick={() => { setShowPwdChange(false); setNewPwd(""); }}>取消</button>
                <button type="submit" className="vault-btn vault-btn--primary" disabled={!newPwd.trim()}>确认修改</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
