import type { EntryType } from "./vault.types";

interface Props {
  tags: string[];
  selected: string[];
  selectedType: EntryType | null;
  pinnedTags: string[];
  counts: Record<string, number>;
  typeCounts: Record<EntryType, number>;
  total: number;
  onSelect: (tag: string | null) => void;
  onSelectType: (type: EntryType | null) => void;
  onTogglePin: (tag: string) => void;
}

const TYPE_OPTIONS: { value: EntryType; label: string }[] = [
  { value: "server", label: "服务器" },
  { value: "password", label: "密码" },
  { value: "custom", label: "自定义" },
];

export function TagSidebar({ tags, selected, selectedType, pinnedTags, counts, typeCounts, total, onSelect, onSelectType, onTogglePin }: Props) {
  return (
    <aside className="vault-sidebar">
      {/* ── Type filter ────────────────────────────────────────────────── */}
      <div className="vault-sidebar-section">
        <div className="vault-sidebar-title">类型</div>
        <button
          className={`vault-tag-item ${selectedType === null ? "active" : ""}`}
          onClick={() => onSelectType(null)}
        >
          <span className="vault-tag-label">全部</span>
          <span className="vault-tag-count">{total}</span>
        </button>
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`vault-tag-item ${selectedType === opt.value ? "active" : ""}`}
            onClick={() => onSelectType(opt.value)}
          >
            <span className="vault-tag-dot" />
            <span className="vault-tag-label">{opt.label}</span>
            <span className="vault-tag-count">{typeCounts[opt.value] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* ── Tag filter ─────────────────────────────────────────────────── */}
      <div className="vault-sidebar-section vault-sidebar-section--scroll">
        <div className="vault-sidebar-title">标签</div>
        <button
          className={`vault-tag-item ${selected.length === 0 ? "active" : ""}`}
          onClick={() => onSelect(null)}
        >
          <span className="vault-tag-label">全部</span>
          <span className="vault-tag-count">{total}</span>
        </button>
        {[...tags].sort((a, b) => {
          const aPinned = pinnedTags.includes(a) ? 0 : 1;
          const bPinned = pinnedTags.includes(b) ? 0 : 1;
          if (aPinned !== bPinned) return aPinned - bPinned;
          return a.localeCompare(b);
        }).map((tag) => (
          <div key={tag} className="vault-tag-row">
            <button
              className={`vault-tag-item ${selected.includes(tag) ? "active" : ""}`}
              onClick={() => onSelect(tag)}
            >
              <span className="vault-tag-dot" />
              <span className="vault-tag-label">{tag}</span>
              <span className="vault-tag-count">{counts[tag] ?? 0}</span>
            </button>
            <button
              className={`vault-tag-pin ${pinnedTags.includes(tag) ? "pinned" : ""}`}
              onClick={() => onTogglePin(tag)}
              title={pinnedTags.includes(tag) ? "取消置顶" : "置顶"}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
