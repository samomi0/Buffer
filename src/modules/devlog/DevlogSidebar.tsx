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
  timeFilter: TimeFilter;
  onToggleArchived: () => void;
  /** 点击标签按钮：循环 none→include→exclude→none */
  onTagFilterChange: (tagId: string) => void;
  onAddTag: (tag: DevlogTag) => void;
  onEditTag: (tag: DevlogTag) => void;
  onPinTag: (tagId: string) => void;
  onDeleteTag: (tagId: string) => void;
  /** 重置所有筛选条件（标签 + 时间） */
  onResetFilters: () => void;
}

export function DevlogSidebar({
  notes,
  tags,
  tagFilters,
  showArchived,
  timeFilter,
  onToggleArchived,
  onTagFilterChange,
  onAddTag,
  onEditTag,
  onPinTag,
  onDeleteTag,
  onResetFilters,
}: Props) {
  const [editingTag, setEditingTag] = useState<DevlogTag | null | "new">(null);
  const devlogOpenCmd = useAppStore((s) => s.devlogOpenCmd);

  const totalActive = notes.filter((n) => !n.archived).length;
  const totalArchived = notes.filter((n) => n.archived).length;

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
      {/* ── 归档开关 ─────────────────────────────────────────── */}
      <div className="devlog-sidebar-section">
        <div className="devlog-archive-toggle-row">
          <span className="devlog-archive-toggle-label">查看归档</span>
          <button
            className={`devlog-archive-toggle ${showArchived ? "active" : ""}`}
            onClick={onToggleArchived}
            role="switch"
            aria-checked={showArchived}
          >
            <span className="devlog-toggle-knob" />
          </button>
          <span className="devlog-sidebar-count">{showArchived ? totalArchived : totalActive}</span>
        </div>
      </div>

      {/* ── 标签列表 ──────────────────────────────────────────── */}
      <div className="devlog-sidebar-section devlog-sidebar-section--scroll">
        <div className="devlog-sidebar-section-title">
          <span>标签</span>
          <button className="devlog-reset-tag-filters-btn" onClick={onResetFilters} title="重置筛选条件">
            <svg width="11" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            
          </button>
        </div>

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
                {tag.pinned && (
                  <svg className="devlog-tag-pin-icon" width="9" height="9" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <path d="M16 1l-1.5 1.5L16 4l-6 6-2.5-1.5L6 10l4 4-5 5 1.5 1.5L11 15l4 4 1.5-1.5L15 16l6-6 1.5 1.5L24 10l-6-6z"/>
                  </svg>
                )}
                <span className="devlog-tag-dot" style={{ background: tag.color }} />
                <span className="devlog-tag-label">{tag.name}</span>
                <span className="devlog-sidebar-count">{tagNoteCount(tag.id)}</span>
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
