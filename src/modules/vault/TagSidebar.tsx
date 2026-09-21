import type { EntryType } from "./vault.types";

interface Props {
  tags: string[];
  tagFilters: Record<string, "include" | "exclude">;
  selectedType: EntryType | null;
  pinnedTags: string[];
  counts: Record<string, number>;
  typeCounts: Record<EntryType, number>;
  total: number;
  onTagFilterChange: (tag: string) => void;
  onResetTagFilters: () => void;
  onSelectType: (type: EntryType | null) => void;
  onTogglePin: (tag: string) => void;
}

const TYPE_OPTIONS: { value: EntryType; label: string }[] = [
  { value: "server", label: "服务器" },
  { value: "password", label: "密码" },
  { value: "custom", label: "自定义" },
];

export function TagSidebar({
  tags, tagFilters, selectedType, pinnedTags,
  counts, typeCounts, total,
  onTagFilterChange, onResetTagFilters, onSelectType, onTogglePin,
}: Props) {
  const hasFilters = Object.keys(tagFilters).length > 0;

  return (
    <aside className="vault-sidebar">
      {/* ── Type filter ────────────────────────────────────────────────── */}
      <div className="vault-sidebar-section">
        <div className="vault-sidebar-title">类型</div>
        <button
          className={`vault-tag-item ${selectedType === null ? "active" : ""}`}
          onClick={() => onSelectType(null)}
        >
          <span className="vault-tag-count">{total}</span>
          <span className="vault-tag-label">全部</span>
        </button>
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`vault-tag-item ${selectedType === opt.value ? "active" : ""}`}
            onClick={() => onSelectType(opt.value)}
          >
            <span className="vault-tag-count">{typeCounts[opt.value] ?? 0}</span>
            <span className="vault-tag-label">{opt.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tag filter（include / exclude 模式，与开发手记保持一致） ─── */}
      <div className="vault-sidebar-section vault-sidebar-section--scroll">
        <div className="vault-sidebar-title-row">
          <span className="vault-sidebar-title">标签</span>
          {hasFilters && (
            <button
              className="vault-reset-tag-btn"
              onClick={onResetTagFilters}
              title="重置标签筛选"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </button>
          )}
        </div>

        {[...tags].sort((a, b) => {
          const aPinned = pinnedTags.includes(a) ? 0 : 1;
          const bPinned = pinnedTags.includes(b) ? 0 : 1;
          if (aPinned !== bPinned) return aPinned - bPinned;
          return a.localeCompare(b);
        }).map((tag) => {
          const state = tagFilters[tag] ?? "none";
          return (
            <div key={tag} className="vault-tag-row">
              <button
                className={`vault-tag-item vault-tag-item--filter vault-tag-item--${state}`}
                onClick={() => onTagFilterChange(tag)}
                title="单击筛选 · 再次点击反向"
              >
                <span className="vault-tag-count">{counts[tag] ?? 0}</span>
                <span className="vault-tag-label">{tag}</span>
                {state === "include" && (
                  <span className="vault-tag-state-badge vault-tag-state-badge--include">+</span>
                )}
                {state === "exclude" && (
                  <span className="vault-tag-state-badge vault-tag-state-badge--exclude">−</span>
                )}
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
          );
        })}
      </div>
    </aside>
  );
}
