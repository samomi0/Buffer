import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { DevlogNote, DevlogTag } from "./devlog.types";
import type { DevlogProgress } from "../../core/stores/appStore";

interface Props {
  note: DevlogNote;
  tags: DevlogTag[];
  progressList?: DevlogProgress[];
  onClick: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onProgressChange?: (progressId: string | undefined) => void;
  /** 看板模式：按下卡片后由看板自行判定拖拽（整卡可拖） */
  onDragPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  /** 拖动中的视觉状态 */
  dragging?: boolean;
}

export function extractPreviewText(content: object, maxChars = 130): string {
  function walk(node: { content?: unknown[]; text?: string }): string {
    if (node.text) return node.text;
    if (!node.content) return "";
    return node.content.map((c) => walk(c as typeof node)).join(" ");
  }
  return walk(content as { content?: unknown[] }).trim().replace(/\s+/g, " ").slice(0, maxChars);
}

export function NoteCard({ note, tags, progressList, onClick, onArchive, onDelete, onProgressChange, onDragPointerDown, dragging }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const noteTags = tags.filter((t) => note.tags.includes(t.id));
  const preview = extractPreviewText(note.content);
  const progress = !note.archived && note.progressId
    ? progressList?.find((p) => p.id === note.progressId)
    : undefined;

  /* 点击卡片外部关闭进度下拉 */
  useEffect(() => {
    if (!dropdownPos) return;
    function onOutside() { setDropdownPos(null); }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [dropdownPos]);

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (confirmDelete) { onDelete(); } else { setConfirmDelete(true); }
  }
  function handleCancelDelete(e: React.MouseEvent) { e.stopPropagation(); setConfirmDelete(false); }
  function handleArchive(e: React.MouseEvent) { e.stopPropagation(); onArchive(); }

  function handleProgressBtnClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (dropdownPos) { setDropdownPos(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, left: rect.left });
  }

  function handlePickProgress(e: React.MouseEvent, pid: string | undefined) {
    e.stopPropagation();
    onProgressChange?.(pid);
    setDropdownPos(null);
  }

  const showProgressBtn = !note.archived && progressList && progressList.length > 0 && !!onProgressChange;

  return (
    <div
      className={dragging ? "devlog-card is-dragging" : "devlog-card"}
      onPointerDown={onDragPointerDown}
      onClick={onClick}
    >
      <div className="devlog-card-actions">
        {/* 进度快捷按钮 */}
        {showProgressBtn && (
          <button
            className={`devlog-card-btn devlog-card-progress-btn${progress ? " has-progress" : ""}`}
            title="设置进度"
            onClick={handleProgressBtnClick}
          >
            <span
              className="devlog-card-progress-indicator"
              style={progress ? { background: progress.color, boxShadow: `0 0 0 1.5px ${progress.color}55` } : undefined}
            />
          </button>
        )}
        <button
          className="devlog-card-btn"
          title={note.archived ? "取消归档" : "归档"}
          onClick={handleArchive}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="21 8 21 21 3 21 3 8" />
            <rect x="1" y="3" width="22" height="5" />
            <line x1="10" y1="12" x2="14" y2="12" />
          </svg>
        </button>
        {confirmDelete ? (
          <>
            <button className="devlog-card-btn devlog-card-btn--confirm-danger" onClick={handleDelete}>确认</button>
            <button className="devlog-card-btn" onClick={handleCancelDelete}>✕</button>
          </>
        ) : (
          <button className="devlog-card-btn devlog-card-btn--danger" title="删除" onClick={handleDelete}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </button>
        )}
      </div>

      <div className="devlog-card-title">{note.title}</div>

      {preview && <div className="devlog-card-preview">{preview}</div>}

      {noteTags.length > 0 && (
        <div className="devlog-card-tags">
          {noteTags.map((t) => (
            <span
              key={t.id}
              className="devlog-tag-capsule"
              style={{ background: `${t.color}1a`, color: t.color, border: `1px solid ${t.color}50` }}
            >
              {t.name}
            </span>
          ))}
        </div>
      )}

      {/* portal 渲染下拉，避免被 overflow:hidden 裁切 */}
      {dropdownPos && showProgressBtn && createPortal(
        <div
          className="devlog-card-progress-dropdown"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className={`devlog-card-progress-option${!note.progressId ? " active" : ""}`}
            onClick={(e) => handlePickProgress(e, undefined)}
          >
            <span className="devlog-card-progress-indicator" style={{ background: "var(--border)" }} />
            无
          </button>
          {progressList!.map((p) => (
            <button
              key={p.id}
              className={`devlog-card-progress-option${note.progressId === p.id ? " active" : ""}`}
              onClick={(e) => handlePickProgress(e, p.id)}
            >
              <span
                className="devlog-card-progress-indicator"
                style={{ background: p.color, boxShadow: `0 0 0 1.5px ${p.color}55` }}
              />
              {p.name}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
