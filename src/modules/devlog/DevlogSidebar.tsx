import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../core/stores/appStore";
import type { DevlogNote, DevlogTag, TimeFilter } from "./devlog.types";
import { getDateRange } from "./devlog.types";
import { TagEditModal } from "./TagEditModal";

interface Props {
  notes: DevlogNote[];
  tags: DevlogTag[];
  tagFilters: Record<string, "include" | "exclude">;
  showArchived: boolean;
  archivedCount: number;
  timeFilter: TimeFilter;
  onToggleArchived: () => void;
  /** 点击标签按钮：循环 none→include→exclude→none */
  onTagFilterChange: (tagId: string) => void;
  onAddTag: (tag: DevlogTag) => void;
  onEditTag: (tag: DevlogTag) => void;
  onPinTag: (tagId: string) => void;
  onDeleteTag: (tagId: string) => void;
}

export function DevlogSidebar({
  notes,
  tags,
  tagFilters,
  showArchived,
  archivedCount,
  timeFilter,
  onToggleArchived,
  onTagFilterChange,
  onAddTag,
  onEditTag,
  onPinTag,
  onDeleteTag,
}: Props) {
  const [editingTag, setEditingTag] = useState<DevlogTag | null | "new">(null);
  const devlogOpenCmd = useAppStore((s) => s.devlogOpenCmd);

  function tagNoteCount(tagId: string) {
    const dateRange = getDateRange(timeFilter);
    return notes.filter((n) => {
      if (showArchived ? !n.archived : n.archived) return false;
      if (!n.tags.includes(tagId)) return false;
      if (dateRange) {
        const d = new Date(n.createdAt);
        if (d < dateRange[0] || d > dateRange[1]) return false;
      }
      return true;
    }).length;
  }

  function handleOpenTagDir(tag: DevlogTag) {
    if (!tag.dir) return;
    invoke("open_dir_with_cmd", { path: tag.dir, cmd: devlogOpenCmd }).catch((err) => {
      console.error("[DevlogSidebar] open_dir_with_cmd failed:", err);
    });
  }

  return (
    <aside className="devlog-sidebar">
      <div className="devlog-sidebar-archive-row">
        <button
          className={`devlog-archive-btn ${showArchived ? "active" : ""}`}
          onClick={onToggleArchived}
          title={showArchived ? "退出归档" : "查看归档"}
          aria-pressed={showArchived}
        >
          <svg className="devlog-archive-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="21 8 21 21 3 21 3 8" />
            <rect x="1" y="3" width="22" height="5" rx="1.5" />
            <line x1="10" y1="12" x2="14" y2="12" />
          </svg>
          <span>归档</span>
          <span className="devlog-sidebar-count">{archivedCount}</span>
        </button>
      </div>
      {/* ── 标签列表 ──────────────────────────────────────────── */}
      <div className="devlog-sidebar-section devlog-sidebar-section--scroll">
        {[...tags].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)).map((tag) => {
          const state = tagFilters[tag.id] ?? "none";
          return (
            <div key={tag.id} className="devlog-tag-filter-row">
              <button
                className={`devlog-tag-filter-btn devlog-tag-filter-btn--${state}`}
                onClick={() => onTagFilterChange(tag.id)}
                onContextMenu={(e) => { e.preventDefault(); setEditingTag(tag); }}
                title="单击筛选 · 再次点击反向 · 右键编辑"
              >
                <span className="devlog-tag-count" style={{ background: `${tag.color}1a`, color: tag.color, borderColor: `${tag.color}50` }}>
                  {tagNoteCount(tag.id)}
                </span>
                <span className="devlog-tag-label">{tag.name}</span>
                {state === "include" && (
                  <span className="devlog-tag-state-badge devlog-tag-state-badge--include">+</span>
                )}
                {state === "exclude" && (
                  <span className="devlog-tag-state-badge devlog-tag-state-badge--exclude">−</span>
                )}
              </button>
              <button
                className="devlog-tag-open-btn"
                onClick={() => tag.dir && handleOpenTagDir(tag)}
                disabled={!tag.dir}
                title={tag.dir ? `在编辑器中打开: ${tag.dir}` : "右键标签可配置目录"}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </button>
              <button
                className={`devlog-tag-pin-btn ${tag.pinned ? "devlog-tag-pin-btn--active" : ""}`}
                onClick={(e) => { e.stopPropagation(); onPinTag(tag.id); }}
                title={tag.pinned ? "取消置顶" : "置顶标签"}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill={tag.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </button>
            </div>
          );
        })}

        <button className="devlog-add-tag-btn" onClick={() => setEditingTag("new")}>
          <span>＋ 添加标签</span>
        </button>
      </div>

      {/* ── 标签编辑弹窗 ──────────────────────────────────────── */}
      {editingTag !== null && (
        <TagEditModal
          tag={editingTag === "new" ? null : editingTag}
          onSave={(tag) => {
            editingTag === "new" ? onAddTag(tag) : onEditTag(tag);
            setEditingTag(null);
          }}
          onDelete={editingTag !== "new" ? () => {
            onDeleteTag((editingTag as DevlogTag).id);
            setEditingTag(null);
          } : undefined}
          onClose={() => setEditingTag(null)}
        />
      )}
    </aside>
  );
}
