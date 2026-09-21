import { useState, useMemo, useEffect } from "react";
import type { DevlogNote, DevlogTag } from "./devlog.types";
import { TimeFilter, getDateRange, timeFilterLabel, TIME_OPTIONS } from "./devlog.types";
import { NoteCard } from "./NoteCard";
import { NoteBoard } from "./NoteBoard";
import { WeeklyReport } from "./WeeklyReport";
import type { DevlogProgress } from "../../core/stores/appStore";

interface Props {
  notes: DevlogNote[];
  /** 全量笔记（含归档、未做标签筛选），仅供周报统计使用 */
  reportNotes: DevlogNote[];
  archivedCount: number;
  tags: DevlogTag[];
  progressList: DevlogProgress[];
  /** 持久化的看板列顺序（含无状态占位），null = 默认 */
  columnOrder: string[] | null;
  onColumnOrderChange: (order: string[]) => void;
  showArchived: boolean;
  timeFilter: TimeFilter;
  onTimeFilterChange: (filter: TimeFilter) => void;
  customFrom: string;
  onCustomFromChange: (v: string) => void;
  customTo: string;
  onCustomToChange: (v: string) => void;
  onToggleArchived: () => void;
  onResetFilters: () => void;
  onOpenNote: (note: DevlogNote) => void;
  onArchiveNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onProgressChange: (noteId: string, progressId: string | undefined) => void;
  onTogglePinned: (noteId: string) => void;
  onNewNote: () => void;
}

function extractText(content: object): string {
  function walk(node: { content?: unknown[]; text?: string }): string {
    if (node.text) return node.text;
    if (!node.content) return "";
    return node.content.map((c) => walk(c as typeof node)).join(" ");
  }
  return walk(content as { content?: unknown[] });
}

/* ── Component ───────────────────────────────────────────────── */
export function NoteGrid({
  notes, reportNotes, archivedCount, tags, progressList, columnOrder, onColumnOrderChange, showArchived,
  timeFilter, onTimeFilterChange, customFrom, onCustomFromChange, customTo, onCustomToChange,
  onToggleArchived, onResetFilters,
  onOpenNote, onArchiveNote, onDeleteNote, onProgressChange, onNewNote,
  onTogglePinned,
}: Props) {
  const [search, setSearch] = useState("");

  // Ctrl+N shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "n") { e.preventDefault(); onNewNote(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNewNote]);

  const activeFilter: TimeFilter = timeFilter.type === "custom"
    ? { type: "custom", from: customFrom, to: customTo }
    : timeFilter;

  const filteredNotes = useMemo(() => {
    const dateRange = getDateRange(activeFilter);
    const q = search.trim().toLowerCase();
    return notes
      .filter((n) => (showArchived ? n.archived : !n.archived))
      .filter((n) => {
        if (!q) return true;
        const tagMatch = tags.filter((t) => n.tags.includes(t.id)).some((t) => t.name.toLowerCase().includes(q));
        return (
          n.title.toLowerCase().includes(q) ||
          tagMatch ||
          extractText(n.content).toLowerCase().includes(q)
        );
      })
      .filter((n) => {
        if (!dateRange) return true;
        const d = new Date(n.createdAt);
        return d >= dateRange[0] && d <= dateRange[1];
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notes, search, activeFilter, showArchived, tags]);

  function handleTimeClick(type: TimeFilter["type"]) {
    if (type === "custom") {
      onTimeFilterChange({ type: "custom", from: customFrom, to: customTo });
    } else {
      onTimeFilterChange({ type } as TimeFilter);
    }
  }

  /* 非查看归档 → 看板；查看归档 → 沿用网格 */
  const boardMode = !showArchived;

  return (
    <div className="devlog-grid-panel">
      {/* 归档、筛选、周报、搜索与新建统一放在同一行 */}
      <div className="devlog-toolbar">
        <div className="devlog-toolbar-leading">
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
          <button className="devlog-reset-btn" onClick={onResetFilters} title="重置筛选条件">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            <span>重置</span>
          </button>
        </div>
        <div className="devlog-time-filter">
          {TIME_OPTIONS.map((type) => (
            <button
              key={type}
              className={`devlog-time-btn ${timeFilter.type === type ? "active" : ""}`}
              onClick={() => handleTimeClick(type)}
            >
              {timeFilterLabel(type)}
            </button>
          ))}
        </div>
        <WeeklyReport notes={reportNotes} tags={tags} progressList={progressList} />
        <div className="devlog-search-input-wrap">
          <svg className="devlog-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="devlog-search-input"
            placeholder="搜索笔记..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="devlog-search-clear" onClick={() => setSearch("")}>×</button>
          )}
        </div>
        <button className="devlog-new-btn" onClick={onNewNote} title="新建笔记 (Ctrl+N)">
          + 新建
        </button>
      </div>

      {timeFilter.type === "custom" && (
        <div className="devlog-custom-range">
          <input
            type="date"
            className="devlog-date-input"
            value={customFrom}
            onChange={(e) => {
              onCustomFromChange(e.target.value);
              onTimeFilterChange({ type: "custom", from: e.target.value, to: customTo });
            }}
          />
          <span className="devlog-date-sep">—</span>
          <input
            type="date"
            className="devlog-date-input"
            value={customTo}
            onChange={(e) => {
              onCustomToChange(e.target.value);
              onTimeFilterChange({ type: "custom", from: customFrom, to: e.target.value });
            }}
          />
        </div>
      )}

      {/* Cards area：非归档 → 看板；查看归档 → 网格 */}
      {boardMode ? (
        <NoteBoard
          notes={filteredNotes}
          tags={tags}
          progressList={progressList}
          columnOrder={columnOrder}
          onOrderChange={onColumnOrderChange}
          onOpenNote={onOpenNote}
          onArchiveNote={onArchiveNote}
          onDeleteNote={onDeleteNote}
          onProgressChange={onProgressChange}
          onTogglePinned={onTogglePinned}
          onNewNote={onNewNote}
        />
      ) : (
        <div className="devlog-cards-area">
          {filteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              tags={tags}
              onClick={() => onOpenNote(note)}
              onArchive={() => onArchiveNote(note.id)}
              onDelete={() => onDeleteNote(note.id)}
            />
          ))}
          {/* New note placeholder */}
          <div className="devlog-card devlog-card--new" onClick={onNewNote}>
            <span className="devlog-card-new-label">＋ 新建笔记</span>
          </div>
        </div>
      )}
    </div>
  );
}
