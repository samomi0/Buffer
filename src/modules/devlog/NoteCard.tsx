import { useState } from "react";
import type { DevlogNote, DevlogTag } from "./devlog.types";

interface Props {
  note: DevlogNote;
  tags: DevlogTag[];
  onClick: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

function extractPreviewText(content: object, maxChars = 130): string {
  function walk(node: { content?: unknown[]; text?: string }): string {
    if (node.text) return node.text;
    if (!node.content) return "";
    return node.content.map((c) => walk(c as typeof node)).join(" ");
  }
  return walk(content as { content?: unknown[] }).trim().replace(/\s+/g, " ").slice(0, maxChars);
}

export function NoteCard({ note, tags, onClick, onArchive, onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const noteTags = tags.filter((t) => note.tags.includes(t.id));
  const preview = extractPreviewText(note.content);

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete();
    } else {
      setConfirmDelete(true);
    }
  }

  function handleCancelDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setConfirmDelete(false);
  }

  function handleArchive(e: React.MouseEvent) {
    e.stopPropagation();
    onArchive();
  }

  return (
    <div className="devlog-card" onClick={onClick}>
      <div className="devlog-card-actions">
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
            <button
              className="devlog-card-btn devlog-card-btn--confirm-danger"
              onClick={handleDelete}
            >
              确认
            </button>
            <button className="devlog-card-btn" onClick={handleCancelDelete}>✕</button>
          </>
        ) : (
          <button
            className="devlog-card-btn devlog-card-btn--danger"
            title="删除"
            onClick={handleDelete}
          >
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

      {preview && (
        <div className="devlog-card-preview">{preview}</div>
      )}

      {noteTags.length > 0 && (
        <div className="devlog-card-tags">
          {noteTags.map((t) => (
            <span
              key={t.id}
              className="devlog-tag-capsule"
              style={{
                background: `${t.color}1a`,
                color: t.color,
                border: `1px solid ${t.color}50`,
              }}
            >
              {t.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
