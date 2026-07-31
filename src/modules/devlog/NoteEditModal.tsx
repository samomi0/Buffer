import { useState, useEffect, useCallback, useRef } from "react";
import type { DevlogNote, DevlogTag, DevlogLink } from "./devlog.types";
import type { DevlogProgress } from "../../core/stores/appStore";
import { DevlogEditor } from "./DevlogEditor";
import { DevlogNodeCtxProvider } from "./DevlogImageNode";
import { saveDevlogImage, loadDevlogImage } from "./useDevlog";
import "./NoteEditModal.css";

/* ── 链接颜色 ──────────────────────────────────────────────────── */
const LINK_COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c",
  "#0f766e", "#15803d", "#b45309", "#0369a1",
];

/* ── TipTap JSON 迁移：提取链接和图片到独立字段 ───────────────── */
type TipTapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

function extractLinksAndImages(rawContent: object): {
  links: DevlogLink[];
  images: string[];
  cleanedContent: object;
} {
  const links: DevlogLink[] = [];
  const images: string[] = [];
  const seenHrefs = new Set<string>();

  function processNode(node: TipTapNode): TipTapNode | null {
    if (node.type === "image") {
      const src = node.attrs?.src as string | undefined;
      if (src) images.push(src);
      return null;
    }
    let newNode: TipTapNode = { ...node };
    if (node.marks && node.marks.length > 0) {
      const newMarks = node.marks.filter((m) => {
        if (m.type === "link") {
          const href = m.attrs?.href as string | undefined;
          const color = m.attrs?.color as string | undefined;
          if (href && !seenHrefs.has(href)) {
            seenHrefs.add(href);
            links.push({ id: crypto.randomUUID(), href, label: node.text || href, color: color || "#2563eb" });
          }
          return false;
        }
        return true;
      });
      newNode = { ...newNode, marks: newMarks.length > 0 ? newMarks : undefined };
    }
    if (node.content && node.content.length > 0) {
      const newContent = node.content.map(processNode).filter(Boolean) as TipTapNode[];
      newNode = { ...newNode, content: newContent };
    }
    return newNode;
  }

  const cleanedContent = processNode(rawContent as TipTapNode) as object;
  return { links, images, cleanedContent };
}

/* ── 图片面板缩略图组件 ─────────────────────────────────────────── */
function ImagePanelThumb({
  src, dataDir, onDelete, onZoom,
}: { src: string; dataDir: string; onDelete: () => void; onZoom: (src: string) => void }) {
  const [imgSrc, setImgSrc] = useState("");
  const isRelative = src.startsWith("images/");

  useEffect(() => {
    if (!isRelative) { setImgSrc(src); return; }
    let cancelled = false;
    loadDevlogImage(dataDir, src)
      .then((url) => { if (!cancelled) setImgSrc(url); })
      .catch(console.error);
    return () => { cancelled = true; };
  }, [dataDir, src, isRelative]);

  async function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(imgSrc);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      document.dispatchEvent(
        new CustomEvent("devlog:toast", { detail: { message: "图片已复制到剪贴板" } })
      );
    } catch {
      // ignore — clipboard API may be restricted
    }
  }

  return (
    <div className="note-panel-img-wrap">
      {imgSrc ? (
        <img src={imgSrc} className="note-panel-img-thumb" onClick={() => onZoom(imgSrc)} onContextMenu={handleContextMenu} draggable={false} alt="" />
      ) : (
        <div className="note-panel-img-loading" />
      )}
      <button className="note-panel-img-delete" onClick={onDelete} title="删除图片">×</button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   NoteEditModal
───────────────────────────────────────────────────────────────── */

interface Props {
  note: DevlogNote;
  allTags: DevlogTag[];
  progressList?: DevlogProgress[];
  dataDir: string;
  onUpdate: (note: DevlogNote) => void;
  onDelete: () => void;
  onClose: () => void;
}

type SaveState = "saved" | "saving" | "error";

export function NoteEditModal({ note, allTags, progressList, dataDir, onUpdate, onDelete, onClose }: Props) {
  // ── 初始化：迁移旧笔记中内嵌的链接和图片 ──────────────────────
  const [localNote, setLocalNote] = useState<DevlogNote>(() => {
    if (note.links !== undefined || note.images !== undefined) {
      return { ...note, links: note.links ?? [], images: note.images ?? [] };
    }
    const { links, images, cleanedContent } = extractLinksAndImages(note.content);
    return { ...note, links, images, content: cleanedContent };
  });
  const didMigrate = useRef(note.links === undefined && note.images === undefined);

  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [editingDate, setEditingDate] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // 链接面板状态
  const [showAddLink, setShowAddLink] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkColor, setNewLinkColor] = useState(LINK_COLORS[0]);
  // 链接行内编辑
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editLinkUrl, setEditLinkUrl] = useState("");
  const [editLinkLabel, setEditLinkLabel] = useState("");
  const [editLinkColor, setEditLinkColor] = useState(LINK_COLORS[0]);
  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);
  const [showProgressPicker, setShowProgressPicker] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── 迁移完成后立即保存 ─────────────────────────────────────── */
  useEffect(() => {
    if (didMigrate.current) {
      onUpdate({ ...localNote, updatedAt: new Date().toISOString() });
      didMigrate.current = false;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 监听图片缩放和 toast 自定义事件 ──────────────────────── */
  useEffect(() => {
    const onZoom = (e: Event) => setZoomSrc((e as CustomEvent<{ src: string }>).detail.src);
    const onToast = (e: Event) => {
      const msg = (e as CustomEvent<{ message: string }>).detail.message;
      setToast(msg);
      setTimeout(() => setToast(null), 2000);
    };
    document.addEventListener("devlog:image-zoom", onZoom);
    document.addEventListener("devlog:toast", onToast);
    return () => {
      document.removeEventListener("devlog:image-zoom", onZoom);
      document.removeEventListener("devlog:toast", onToast);
    };
  }, []);

  /* ── ESC 关闭（按层次） ─────────────────────────────────── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (zoomSrc) { setZoomSrc(null); return; }
      if (isEditorFullscreen) { setIsEditorFullscreen(false); return; }
      if (showProgressPicker) { setShowProgressPicker(false); return; }
      if (editingLinkId) { setEditingLinkId(null); return; }
      if (showAddLink) { setShowAddLink(false); return; }
      if (showTagPicker) { setShowTagPicker(false); return; }
      if (editingDate) { setEditingDate(false); return; }
      if (confirmDelete) { setConfirmDelete(false); return; }
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, zoomSrc, isEditorFullscreen, showProgressPicker, editingLinkId, showAddLink, showTagPicker, editingDate, confirmDelete]);

  /* ── 防抖自动保存 ────────────────────────────────────────── */
  const scheduleAutosave = useCallback(
    (updated: DevlogNote) => {
      setSaveState("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        onUpdate({ ...updated, updatedAt: new Date().toISOString() });
        setSaveState("saved");
      }, 500);
    },
    [onUpdate]
  );

  function patchNote(patch: Partial<DevlogNote>) {
    setLocalNote((prev) => {
      const next = { ...prev, ...patch };
      scheduleAutosave(next);
      return next;
    });
  }

  function toggleTag(tagId: string) {
    patchNote({
      tags: localNote.tags.includes(tagId)
        ? localNote.tags.filter((id) => id !== tagId)
        : [...localNote.tags, tagId],
    });
  }

  /* ── 链接操作 ────────────────────────────────────────────────── */
  function addLink() {
    const url = newLinkUrl.trim();
    if (!url) return;
    const href = /^https?:\/\//.test(url) ? url : `https://${url}`;
    const link: DevlogLink = {
      id: crypto.randomUUID(),
      href,
      label: newLinkLabel.trim() || href,
      color: newLinkColor,
    };
    patchNote({ links: [...(localNote.links ?? []), link] });
    setNewLinkUrl("");
    setNewLinkLabel("");
    setNewLinkColor(LINK_COLORS[0]);
    setShowAddLink(false);
  }

  function deleteLink(id: string) {
    patchNote({ links: (localNote.links ?? []).filter((l) => l.id !== id) });
  }

  function openLink(href: string) {
    import("@tauri-apps/plugin-shell").then(({ open }) => open(href)).catch(() => {});
  }

  /* ── 链接行内编辑 ───────────────────────────────────────────── */
  function startEditLink(link: DevlogLink) {
    setEditingLinkId(link.id);
    setEditLinkUrl(link.href);
    setEditLinkLabel(link.label);
    setEditLinkColor(link.color);
  }

  function saveEditLink() {
    if (!editingLinkId) return;
    const url = editLinkUrl.trim();
    if (!url) { cancelEditLink(); return; }
    const href = /^https?:\/\//.test(url) ? url : `https://${url}`;
    patchNote({
      links: (localNote.links ?? []).map((l) =>
        l.id === editingLinkId ? { ...l, href, label: editLinkLabel.trim() || href, color: editLinkColor } : l
      ),
    });
    setEditingLinkId(null);
  }

  function cancelEditLink() {
    setEditingLinkId(null);
  }

  /* ── 图片操作 ────────────────────────────────────────────────── */
  async function addImageFromBlob(blob: File) {
    try {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      const relativePath = await saveDevlogImage(dataDir, localNote.id, dataUrl);
      patchNote({ images: [...(localNote.images ?? []), relativePath] });
    } catch (e) {
      console.error("图片添加失败", e);
    }
  }

  /** 从 URL 下载并保存图片到面板 */
  async function addImageFromUrl(url: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) return;
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      const relativePath = await saveDevlogImage(dataDir, localNote.id, dataUrl);
      patchNote({ images: [...(localNote.images ?? []), relativePath] });
    } catch (e) {
      console.error("图片下载失败", e);
    }
  }

  /** 粘贴 HTML 中的链接 → 加入链接面板（去重） */
  function handlePastedLinks(pasted: { href: string; label: string }[]) {
    const existing = localNote.links ?? [];
    const existingHrefs = new Set(existing.map((l) => l.href));
    const newLinks: DevlogLink[] = [];
    for (const p of pasted) {
      if (existingHrefs.has(p.href)) continue;
      existingHrefs.add(p.href);
      newLinks.push({
        id: crypto.randomUUID(),
        href: p.href,
        label: p.label || p.href,
        color: LINK_COLORS[Math.floor(Math.random() * LINK_COLORS.length)],
      });
    }
    if (newLinks.length > 0) {
      patchNote({ links: [...existing, ...newLinks] });
    }
  }

  function deleteImage(idx: number) {
    patchNote({ images: (localNote.images ?? []).filter((_, i) => i !== idx) });
  }

  /* ── 模态层粘贴（非编辑器内的图片粘贴） ────────────────────── */
  function handleModalPaste(e: React.ClipboardEvent) {
    const target = e.target as HTMLElement;
    if (target.isContentEditable) return; // 由编辑器的 onImagePaste 处理
    const items = Array.from(e.clipboardData.items);
    const imgItem = items.find((i) => i.type.startsWith("image/"));
    if (!imgItem) return;
    const blob = imgItem.getAsFile();
    if (blob) { e.preventDefault(); addImageFromBlob(blob); }
  }

  const noteTags = allTags.filter((t) => localNote.tags.includes(t.id));
  const dateOnly = localNote.createdAt.slice(0, 10);
  const links = localNote.links ?? [];
  const images = localNote.images ?? [];

  return (
    <div
      className="note-modal-overlay"
    >
      <div className={`note-modal${isEditorFullscreen ? " note-modal--fullscreen" : ""}`} onPaste={handleModalPaste}>
        {/* ── 弹窗头部 ─────────────────────────────────────── */}
        <div className="note-modal-header">
          <div className="note-modal-row1">
            <input
              className="note-modal-title-input"
              value={localNote.title}
              onChange={(e) => patchNote({ title: e.target.value })}
              placeholder="标题"
            />
            <div className="note-modal-row1-right">
              <span className={`note-modal-save-badge note-modal-save-badge--${saveState}`}>
                {saveState === "saving" ? "保存中…" : saveState === "error" ? "保存失败" : "已保存"}
              </span>
              <button className="note-modal-close-btn" onClick={onClose} title="关闭 (Esc)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <div className="note-modal-row2">
            {/* 标签 + 编辑 */}
            <div className="note-modal-tags-area">
              {noteTags.map((t) => (
                <span
                  key={t.id}
                  className="devlog-tag-capsule"
                  style={{ background: `${t.color}1a`, color: t.color, border: `1px solid ${t.color}50` }}
                >
                  {t.name}
                </span>
              ))}
              <div className="note-modal-tag-picker-wrap">
                <button
                  className="note-modal-tag-btn"
                  onClick={() => setShowTagPicker((v) => !v)}
                >
                  {noteTags.length === 0 ? "＋ 添加标签" : "✎ 编辑标签"}
                </button>
                {showTagPicker && (
                  <div className="note-modal-tag-dropdown">
                    {allTags.length === 0 ? (
                      <div className="note-modal-tag-empty">暂无标签，请在左侧添加</div>
                    ) : (
                      allTags.map((t) => (
                        <button
                          key={t.id}
                          className={`note-modal-tag-option ${localNote.tags.includes(t.id) ? "checked" : ""}`}
                          onClick={() => toggleTag(t.id)}
                        >
                          <span
                            className="devlog-tag-capsule"
                            style={{ background: `${t.color}1a`, color: t.color, border: `1px solid ${t.color}50` }}
                          >
                            {t.name}
                          </span>
                          {localNote.tags.includes(t.id) && (
                            <span className="note-modal-tag-check">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 日期 + 归档 + 删除 */}
            <div className="note-modal-meta-area">
              {editingDate ? (
                <input
                  type="date"
                  className="devlog-date-input"
                  value={dateOnly}
                  onChange={(e) => {
                    patchNote({ createdAt: e.target.value ? `${e.target.value}T00:00:00` : localNote.createdAt });
                    setEditingDate(false);
                  }}
                  onBlur={() => setEditingDate(false)}
                  autoFocus
                />
              ) : (
                <button className="note-modal-date-btn" onClick={() => setEditingDate(true)} title="点击修改日期">
                  {dateOnly}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 4 }}>
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              )}

              {/* 进度状态按钮 */}
              {progressList && progressList.length > 0 && (
                <div className="note-modal-progress-wrap">
                  <button
                    className="note-modal-progress-btn"
                    disabled={localNote.archived}
                    title={localNote.archived ? "归档笔记不设置进度" : "设置进度"}
                    onClick={() => !localNote.archived && setShowProgressPicker((v) => !v)}
                    style={
                      !localNote.archived && localNote.progressId
                        ? {
                            color: progressList.find((p) => p.id === localNote.progressId)?.color,
                            background: `${progressList.find((p) => p.id === localNote.progressId)?.color}18`,
                            borderColor: `${progressList.find((p) => p.id === localNote.progressId)?.color}45`,
                          }
                        : undefined
                    }
                  >
                    <span
                      className="note-modal-progress-dot"
                      style={
                        !localNote.archived && localNote.progressId
                          ? { background: progressList.find((p) => p.id === localNote.progressId)?.color }
                          : undefined
                      }
                    />
                    {(!localNote.archived && localNote.progressId
                      ? progressList.find((p) => p.id === localNote.progressId)?.name
                      : null) ?? "进度"}
                  </button>
                  {showProgressPicker && !localNote.archived && (
                    <div className="note-modal-progress-dropdown">
                      <button
                        className={`note-modal-progress-option ${!localNote.progressId ? "active" : ""}`}
                        onClick={() => { patchNote({ progressId: undefined }); setShowProgressPicker(false); }}
                      >
                        <span className="note-modal-progress-dot note-modal-progress-dot--none" />
                        无
                      </button>
                      {progressList.map((p) => (
                        <button
                          key={p.id}
                          className={`note-modal-progress-option ${localNote.progressId === p.id ? "active" : ""}`}
                          onClick={() => { patchNote({ progressId: p.id }); setShowProgressPicker(false); }}
                        >
                          <span className="note-modal-progress-dot" style={{ background: p.color }} />
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                className={`note-modal-action-btn ${localNote.archived ? "note-modal-action-btn--on" : ""}`}
                title={localNote.archived ? "取消归档" : "归档"}
                onClick={() => patchNote({ archived: !localNote.archived })}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="21 8 21 21 3 21 3 8" />
                  <rect x="1" y="3" width="22" height="5" />
                  <line x1="10" y1="12" x2="14" y2="12" />
                </svg>
              </button>

              {confirmDelete ? (
                <>
                  <button className="note-modal-action-btn note-modal-action-btn--danger" onClick={onDelete}>
                    确认删除
                  </button>
                  <button className="note-modal-action-btn" onClick={() => setConfirmDelete(false)}>取消</button>
                </>
              ) : (
                <button
                  className="note-modal-action-btn note-modal-action-btn--danger-outline"
                  title="删除笔记"
                  onClick={() => setConfirmDelete(true)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── 分界线 ──────────────────────────────────────────── */}
        <div className="note-modal-divider" />

        {/* ── 链接面板（分界线下方，横向滚动） ────────────────── */}
        <div className="note-modal-links-panel" onClick={() => setShowTagPicker(false)}>
          {links.map((link) =>
            editingLinkId === link.id ? (
              /* ── 行内编辑表单 ────────────────────────────── */
              <div key={link.id} className="note-modal-link-edit-form">
                <input
                  className="note-modal-link-url-input"
                  value={editLinkUrl}
                  onChange={(e) => setEditLinkUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveEditLink(); if (e.key === "Escape") cancelEditLink(); }}
                  autoFocus
                />
                <input
                  className="note-modal-link-label-input"
                  placeholder="名称"
                  value={editLinkLabel}
                  onChange={(e) => setEditLinkLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveEditLink(); if (e.key === "Escape") cancelEditLink(); }}
                />
                <div className="note-modal-link-edit-row2">
                  <div className="note-modal-link-colors">
                    {LINK_COLORS.map((c) => (
                      <button key={c} type="button"
                        className={`note-modal-link-color-dot ${editLinkColor === c ? "selected" : ""}`}
                        style={{ background: c }} onClick={() => setEditLinkColor(c)}
                      />
                    ))}
                    <div className="note-modal-link-color-custom-wrap">
                      <input
                        type="color"
                        className="note-modal-link-color-custom"
                        value={editLinkColor}
                        onChange={(e) => setEditLinkColor(e.target.value)}
                        title="自定义颜色"
                      />
                      <span className="note-modal-link-color-custom-label">自定义</span>
                    </div>
                  </div>
                  <button className="note-modal-link-confirm-btn" onClick={saveEditLink}>保存</button>
                  <button className="note-modal-link-cancel-btn" onClick={cancelEditLink}>×</button>
                  <button className="note-modal-link-delete-btn" onClick={() => deleteLink(link.id)} title="删除链接">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              /* ── 胶囊按钮 ───────────────────────────────── */
              <div key={link.id} className="note-modal-link-item">
                <button
                  className="note-modal-link-capsule"
                  style={{ color: link.color, background: `${link.color}14`, borderColor: `${link.color}55` }}
                  onClick={() => openLink(link.href)}
                  title={link.href}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  <span className="note-modal-link-label">{link.label}</span>
                  <button
                    className="note-modal-link-edit-trigger"
                    onClick={(e) => { e.stopPropagation(); startEditLink(link); }}
                    title="编辑链接"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                </button>
              </div>
            )
          )}
          {showAddLink ? (
            <div className="note-modal-link-form">
              <div className="note-modal-link-form-row1">
                <input
                  className="note-modal-link-url-input"
                  placeholder="输入 URL..."
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addLink(); if (e.key === "Escape") setShowAddLink(false); }}
                  autoFocus
                />
                <input
                  className="note-modal-link-label-input"
                  placeholder="显示名称（可选）"
                  value={newLinkLabel}
                  onChange={(e) => setNewLinkLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addLink(); if (e.key === "Escape") setShowAddLink(false); }}
                />
              </div>
              <div className="note-modal-link-form-row2">
                <div className="note-modal-link-colors">
                  {LINK_COLORS.map((c) => (
                    <button key={c} type="button"
                      className={`note-modal-link-color-dot ${newLinkColor === c ? "selected" : ""}`}
                      style={{ background: c }} onClick={() => setNewLinkColor(c)}
                    />
                  ))}
                </div>
                <button className="note-modal-link-confirm-btn" onClick={addLink}>确认</button>
                <button className="note-modal-link-cancel-btn" onClick={() => setShowAddLink(false)}>×</button>
              </div>
            </div>
          ) : (
            <button className="note-modal-link-add-btn" onClick={() => setShowAddLink(true)}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>链接</span>
            </button>
          )}
        </div>

        {/* ── 编辑器区域 ───────────────────────────────────────── */}
        <div className="note-modal-body" onClick={() => { setShowTagPicker(false); }}>          <button
            className="note-modal-editor-fullscreen-btn"
            onClick={(e) => { e.stopPropagation(); setIsEditorFullscreen((v) => !v); }}
            title={isEditorFullscreen ? "退出全屏 (Esc)" : "全屏编辑"}
          >
            {isEditorFullscreen ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" />
                <line x1="10" y1="14" x2="3" y2="21" /><line x1="21" y1="3" x2="14" y2="10" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            )}
          </button>          <DevlogNodeCtxProvider value={{ dataDir }}>
            <DevlogEditor
              initialContent={note.content}
              dataDir={dataDir}
              noteId={localNote.id}
              onChange={(content) => patchNote({ content })}
              hideLinkToolbar
              onImagePaste={addImageFromBlob}
              onLinkPaste={handlePastedLinks}
              onImageUrlPaste={(urls) => urls.forEach(addImageFromUrl)}
            />
          </DevlogNodeCtxProvider>

          {/* ── 图片面板（正文编辑底部，横向滚动） ────────────── */}
          <div className="note-modal-images-panel">
            {images.map((imgPath, idx) => (
              <ImagePanelThumb
                key={`${imgPath}-${idx}`}
                src={imgPath}
                dataDir={dataDir}
                onDelete={() => deleteImage(idx)}
                onZoom={(src) => setZoomSrc(src)}
              />
            ))}
            {images.length === 0 && (
              <span className="note-modal-images-empty">粘贴图片（Ctrl+V）</span>
            )}
          </div>
        </div>
      </div>

      {/* ── 图片放大灯箱 ─────────────────────────────────────── */}
      {zoomSrc && (
        <div
          className="devlog-zoom-overlay"
          onClick={() => setZoomSrc(null)}
          onContextMenu={(e) => { e.preventDefault(); setZoomSrc(null); }}
        >
          <img
            src={zoomSrc}
            className="devlog-zoom-img"
            onClick={(e) => e.stopPropagation()}
            alt=""
          />
        </div>
      )}

      {/* ── Toast 气泡 ───────────────────────────────────────── */}
      {toast && <div className="devlog-toast">{toast}</div>}
    </div>
  );
}
