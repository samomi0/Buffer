import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "../../core/stores/appStore";
import type { DevlogNote, DevlogTag, TimeFilter } from "./devlog.types";
import { loadAllNotes, loadTags, saveNote, deleteNote, saveTags, deleteNoteImages } from "./useDevlog";
import { readWorkbenchSettings, writeWorkbenchSettings } from "../../core/lib/workbenchSettings";
import { DevlogSidebar } from "./DevlogSidebar";
import { NoteGrid } from "./NoteGrid";
import { NoteEditModal } from "./NoteEditModal";
import "./DevlogPage.css";

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayTitle(): string {
  return formatDateKey(new Date());
}

function initialContent(): object {
  return { type: "doc", content: [] };
}

export function DevlogPage() {
  const closeTool = useAppStore((s) => s.closeTool);
  const dataDir = useAppStore((s) => s.dataDir)!;
  const devlogDateFilter = useAppStore((s) => s.devlogDateFilter);
  const setDevlogDateFilter = useAppStore((s) => s.setDevlogDateFilter);
  const devlogProgress = useAppStore((s) => s.devlogProgress);
  const devlogColumnOrder = useAppStore((s) => s.devlogColumnOrder);
  const setDevlogColumnOrder = useAppStore((s) => s.setDevlogColumnOrder);

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

  const [notes, setNotes] = useState<DevlogNote[]>([]);
  const [tags, setTags] = useState<DevlogTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [tagFilters, setTagFilters] = useState<Record<string, "include" | "exclude">>({});
  const [timeFilter, setTimeFilter] = useState<TimeFilter>({ type: "all" });
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  /* ── 初始化加载 ─────────────────────────────────────────────── */
  useEffect(() => {
    Promise.all([loadAllNotes(dataDir), loadTags(dataDir)])
      .then(([ns, ts]) => {
        // 防御：过滤掉非笔记条目（如 tags.json 被误读产生的数组）
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const validNotes = (ns as any[]).filter((n: any) =>
          typeof n.id === "string" && typeof n.title === "string" && typeof n.content === "object"
        ) as DevlogNote[];
        const validTags = Array.isArray(ts) ? ts : [];
        setNotes(validNotes);
        setTags(validTags);
      })
      .catch((e) => console.error("DevLog: load failed", e))
      .finally(() => setLoading(false));
  }, [dataDir]);

  /* ── 标签筛选：none → include → exclude → none ─────────────── */
  const handleTagFilterChange = useCallback((tagId: string) => {
    setTagFilters((prev) => {
      const cur: string | undefined = prev[tagId];
      const next = { ...prev };
      if (cur === undefined) next[tagId] = "include";
      else if (cur === "include") next[tagId] = "exclude";
      else delete next[tagId];
      return next;
    });
  }, []);

  /* ── 按标签筛选器过滤笔记（搜索和时间过滤由 NoteGrid 负责） ── */
  const includeTagIds = Object.entries(tagFilters).filter(([, s]) => s === "include").map(([id]) => id);
  const excludeTagIds = Object.entries(tagFilters).filter(([, s]) => s === "exclude").map(([id]) => id);
  const tagFilteredNotes = notes.filter((n) => {
    if (excludeTagIds.some((id) => n.tags.includes(id))) return false;
    if (includeTagIds.length > 0 && !includeTagIds.some((id) => n.tags.includes(id))) return false;
    return true;
  });

  /* ── CRUD ───────────────────────────────────────────────────── */
  async function handleUpdateNote(updated: DevlogNote) {
    await saveNote(dataDir, updated);
    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === updated.id);
      if (idx === -1) return [updated, ...prev];
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  }

  function handleNewNote() {
    const now = new Date().toISOString();
    const note: DevlogNote = {
      id: crypto.randomUUID(),
      title: todayTitle(),
      content: initialContent(),
      tags: [],
      createdAt: now,
      updatedAt: now,
      archived: false,
    };
    setNotes((prev) => [note, ...prev]);
    setEditingNoteId(note.id);
    saveNote(dataDir, note).catch(console.error);
  }

  async function handleDeleteNote(id: string) {
    await Promise.all([
      deleteNote(dataDir, id),
      deleteNoteImages(dataDir, id),
    ]);
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (editingNoteId === id) setEditingNoteId(null);
  }

  function handleArchiveNote(id: string) {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    const updated = { ...n, archived: !n.archived, updatedAt: new Date().toISOString() };
    handleUpdateNote(updated);
  }

  function handleProgressChange(noteId: string, progressId: string | undefined) {
    const n = notes.find((x) => x.id === noteId);
    if (!n) return;
    if (n.progressId === progressId) return;
    const now = new Date();
    handleUpdateNote({ ...n, progressId, progressAt: formatDateKey(now), updatedAt: now.toISOString() });
  }

  async function handleAddTag(tag: DevlogTag) {
    const next = [...tags, tag];
    setTags(next);
    await saveTags(dataDir, next);
  }

  /* ── 看板列顺序（含无状态列）持久化到数据 ────────────────── */
  async function handleColumnOrderChange(order: string[]) {
    setDevlogColumnOrder(order);
    try {
      const settings = await readWorkbenchSettings(dataDir);
      await writeWorkbenchSettings(dataDir, { ...settings, devlogColumnOrder: order });
    } catch {
      /* ignore */
    }
  }

  async function handleEditTag(tag: DevlogTag) {
    const next = tags.map((t) => (t.id === tag.id ? tag : t));
    setTags(next);
    await saveTags(dataDir, next);
  }

  async function handleDeleteTag(tagId: string) {
    // 从所有笔记中移除此标签
    const updatedNotes = notes.map((n) => {
      if (!n.tags.includes(tagId)) return n;
      const updated = { ...n, tags: n.tags.filter((id) => id !== tagId), updatedAt: new Date().toISOString() };
      saveNote(dataDir, updated).catch(console.error);
      return updated;
    });
    setNotes(updatedNotes);
    // 从标签列表中删除
    const newTags = tags.filter((t) => t.id !== tagId);
    setTags(newTags);
    await saveTags(dataDir, newTags);
    // 清除筛选状态
    setTagFilters((prev) => {
      const next = { ...prev };
      delete next[tagId];
      return next;
    });
  }

  async function handlePinTag(tagId: string) {
    const newTags = tags.map((t) => t.id === tagId ? { ...t, pinned: !t.pinned } : t);
    setTags(newTags);
    await saveTags(dataDir, newTags);
  }

  /* ── 由日历热力图传入的日期筛选 ─────────────────────────────── */
  useEffect(() => {
    if (!devlogDateFilter) return;
    setTimeFilter({ type: "custom", from: devlogDateFilter, to: devlogDateFilter });
    setCustomFrom(devlogDateFilter);
    setCustomTo(devlogDateFilter);
    setDevlogDateFilter(null);
  }, [devlogDateFilter, setDevlogDateFilter]);

  /* ── 重置所有筛选条件 ─────────────────────────────────────── */
  const handleResetFilters = useCallback(() => {
    setTagFilters({});
    setTimeFilter({ type: "all" });
    setCustomFrom("");
    setCustomTo("");
  }, []);

  /* ── 找到当前打开的笔记 ─────────────────────────────────────── */
  const editingNote = editingNoteId ? notes.find((n) => n.id === editingNoteId) ?? null : null;

  if (loading) {
    return (
      <div className="devlog-page">
        <div className="devlog-loading">加载中…</div>
      </div>
    );
  }

  return (
    <div className="devlog-page">
      {/* ── 主体：左栏 + 右栏 ────────────────────────────────── */}
      <div className="devlog-main">
        <DevlogSidebar
          notes={notes}
          tags={tags}
          tagFilters={tagFilters}
          showArchived={showArchived}
          timeFilter={timeFilter}
          onToggleArchived={() => setShowArchived((v) => !v)}
          onTagFilterChange={handleTagFilterChange}
          onAddTag={handleAddTag}
          onEditTag={handleEditTag}
          onPinTag={handlePinTag}
          onDeleteTag={handleDeleteTag}
          onResetFilters={handleResetFilters}
        />
        <NoteGrid
          notes={tagFilteredNotes}
          reportNotes={notes}
          tags={tags}
          progressList={devlogProgress}
          columnOrder={devlogColumnOrder}
          onColumnOrderChange={handleColumnOrderChange}
          showArchived={showArchived}
          timeFilter={timeFilter}
          onTimeFilterChange={setTimeFilter}
          customFrom={customFrom}
          onCustomFromChange={setCustomFrom}
          customTo={customTo}
          onCustomToChange={setCustomTo}
          onOpenNote={(n) => setEditingNoteId(n.id)}
          onArchiveNote={handleArchiveNote}
          onDeleteNote={handleDeleteNote}
          onProgressChange={handleProgressChange}
          onNewNote={handleNewNote}
        />
      </div>

      {/* ── 笔记编辑弹窗 ─────────────────────────────────────── */}
      {editingNote && (
        <NoteEditModal
          key={editingNote.id}
          note={editingNote}
          allTags={tags}
          progressList={devlogProgress}
          dataDir={dataDir}
          onUpdate={handleUpdateNote}
          onDelete={() => handleDeleteNote(editingNote.id)}
          onClose={() => setEditingNoteId(null)}
        />
      )}
    </div>
  );
}
