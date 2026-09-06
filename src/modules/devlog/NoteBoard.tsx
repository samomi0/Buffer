import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, Ref } from "react";
import { createPortal } from "react-dom";
import type { DevlogNote, DevlogTag } from "./devlog.types";
import type { DevlogProgress } from "../../core/stores/appStore";
import { NoteCard, extractPreviewText } from "./NoteCard";

/* 无状态列的标识 key（不可能与真实进度 id 冲突）。作为普通列之一参与排序，默认在首位。 */
export const NO_STATUS_KEY = "__no_status__";

const DRAG_THRESHOLD = 5;
const AUTO_SCROLL_ZONE = 28;
const AUTO_SCROLL_SPEED = 16;

interface ColumnDef {
  key: string;
  /** 有值时表示对应某个进度状态列；无值表示“无状态”列 */
  progressId?: string;
  name: string;
  color: string;
}

interface Props {
  /** 已按 归档/标签/时间/搜索 过滤的笔记 */
  notes: DevlogNote[];
  tags: DevlogTag[];
  progressList: DevlogProgress[];
  /** 持久化在数据中的列顺序（含 NO_STATUS_KEY 与进度 id）；null = 默认顺序 */
  columnOrder: string[] | null;
  onOrderChange: (order: string[]) => void;
  onOpenNote: (note: DevlogNote) => void;
  onArchiveNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onProgressChange: (noteId: string, progressId: string | undefined) => void;
  onNewNote: () => void;
}

/** 合并持久化顺序与进度定义：剔除失效 id、补充新增状态；无状态列默认最左 */
function resolveOrder(progressIds: string[], saved: string[] | null): string[] {
  const valid = new Set(progressIds);
  const out: string[] = [];
  const source = Array.isArray(saved) && saved.length > 0 ? saved : [NO_STATUS_KEY, ...progressIds];
  for (const k of source) {
    if ((k === NO_STATUS_KEY || valid.has(k)) && !out.includes(k)) out.push(k);
  }
  for (const k of [NO_STATUS_KEY, ...progressIds]) {
    if (!out.includes(k)) out.push(k);
  }
  return out;
}

interface DragSession {
  kind: "card" | "col";
  /** card = 笔记 id；col = 列 key */
  key: string;
  pointerId: number;
  startX: number;
  startY: number;
  /** 实时指针坐标（供自动滚动时刷新高亮） */
  curX: number;
  curY: number;
  moved: boolean;
  /** 卡片拖拽时的抓取信息：相对卡片的落点与卡片尺寸（供浮影跟手） */
  grab?: { offsetX: number; offsetY: number; w: number; h: number };
}

/* ── 拖拽浮影：跟随指针的卡片克隆（跟手动效） ─────────────── */
function DragGhostCard({ note, tags, width, height, initialTransform, innerRef }: {
  note: DevlogNote;
  tags: DevlogTag[];
  width: number;
  height: number;
  initialTransform: string;
  innerRef: Ref<HTMLDivElement>;
}) {
  const noteTags = tags.filter((t) => note.tags.includes(t.id));
  const preview = extractPreviewText(note.content);
  return (
    <div
      ref={innerRef}
      className="devlog-card devlog-drag-ghost"
      style={{ width, height, transform: initialTransform }}
    >
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
    </div>
  );
}

/* ── Component ───────────────────────────────────────────────── */
export function NoteBoard({
  notes, tags, progressList, columnOrder, onOrderChange,
  onOpenNote, onArchiveNote, onDeleteNote, onProgressChange, onNewNote,
}: Props) {
  const progressIds = useMemo(() => progressList.map((p) => p.id), [progressList]);

  const colById = useMemo<Record<string, ColumnDef>>(() => {
    const m: Record<string, ColumnDef> = {
      [NO_STATUS_KEY]: { key: NO_STATUS_KEY, name: "无状态", color: "var(--text-muted)" },
    };
    for (const p of progressList) {
      m[p.id] = { key: p.id, progressId: p.id, name: p.name, color: p.color };
    }
    return m;
  }, [progressList]);

  /* 看板列顺序：无状态列是普通一列（默认最左），可与状态列互拖 */
  const order = useMemo(() => resolveOrder(progressIds, columnOrder), [progressIds, columnOrder]);
  const orderRef = useRef(order);
  orderRef.current = order;

  const columns = order.map((k) => colById[k]).filter((c): c is ColumnDef => !!c);

  /* 各列笔记分组 + 列内按时间倒序 */
  const colNotes = useMemo(() => {
    const map: Record<string, DevlogNote[]> = {};
    for (const k of [NO_STATUS_KEY, ...progressIds]) map[k] = [];
    const pidSet = new Set(progressIds);
    for (const n of notes) {
      const key = n.progressId && pidSet.has(n.progressId) ? n.progressId : NO_STATUS_KEY;
      map[key].push(n);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return map;
  }, [notes, progressIds]);

  /* ── 指针拖拽（不依赖 HTML5 DnD，WebView 内更可靠） ───────── */
  const boardRef = useRef<HTMLDivElement | null>(null);
  const colRefs = useRef(new Map<string, HTMLDivElement>());
  const dragRef = useRef<DragSession | null>(null);
  const suppressClickRef = useRef(false);
  const autoScrollRef = useRef<{ raf: number | null; dir: number }>({ raf: null, dir: 0 });

  const [reorderTarget, setReorderTarget] = useState<{ key: string; side: "before" | "after" } | null>(null);
  const [cardDropKey, setCardDropKey] = useState<string | null>(null);
  const [dragColKey, setDragColKey] = useState<string | null>(null);
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [dragGhost, setDragGhost] = useState<{
    note: DevlogNote;
    w: number;
    h: number;
    offsetX: number;
    offsetY: number;
    x: number;
    y: number;
  } | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);

  /* 根据会话当前坐标刷新高亮（拖动 + 自动滚动时共用） */
  const refreshTargetRef = useRef<() => void>(() => {});
  function updateDragTarget() {
    const s = dragRef.current;
    if (!s || !s.moved) return;
    if (s.kind === "card") {
      setCardDropKey(findColumnAt(s.curX, s.curY));
    } else {
      const t = reorderCandidate(s.curX, s.curY);
      setReorderTarget(t ? { key: t.key, side: t.side } : null);
    }
  }
  refreshTargetRef.current = updateDragTarget;

  function startAutoScroll(dir: number) {
    const st = autoScrollRef.current;
    if (st.dir === dir) return;
    st.dir = dir;
    if (dir === 0) {
      if (st.raf !== null) { cancelAnimationFrame(st.raf); st.raf = null; }
      return;
    }
    if (st.raf === null) {
      const tick = () => {
        const s = autoScrollRef.current;
        if (s.raf === null) return;
        const b = boardRef.current;
        if (b) b.scrollLeft += s.dir * AUTO_SCROLL_SPEED;
        // 内容随滚动位移后，按当前指针位置刷新插入/落点提示
        refreshTargetRef.current();
        s.raf = requestAnimationFrame(tick);
      };
      st.raf = requestAnimationFrame(tick);
    }
  }

  function findColumnAt(x: number, y: number): string | null {
    for (const [key, el] of colRefs.current) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return key;
    }
    return null;
  }

  function reorderCandidate(x: number, y: number): { key: string; side: "before" | "after" } | null {
    const entries = Array.from(colRefs.current.entries());
    if (entries.length === 0) return null;
    const hit = findColumnAt(x, y);
    if (hit) {
      const el = colRefs.current.get(hit)!;
      const r = el.getBoundingClientRect();
      return { key: hit, side: x < r.left + r.width / 2 ? "before" : "after" };
    }
    let best: { key: string; side: "before" | "after" } | null = null;
    let bestD = Infinity;
    for (const [key, el] of entries) {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const d = Math.abs(x - cx);
      if (d < bestD) { bestD = d; best = { key, side: x < cx ? "before" : "after" }; }
    }
    return best;
  }

  function applyReorder(fromKey: string, targetKey: string, side: "before" | "after") {
    if (fromKey === targetKey) return;
    const cur = orderRef.current;
    const next = cur.filter((k) => k !== fromKey);
    const i = next.indexOf(targetKey);
    const idx = i < 0 ? next.length : (side === "before" ? i : i + 1);
    next.splice(idx, 0, fromKey);
    onOrderChange(next);
  }

  /* 移动 / 抬起 / 取消（经 ref 转发到稳定的全局监听） */
  const handleMove = (e: PointerEvent) => {
    const s = dragRef.current;
    if (!s || s.pointerId !== e.pointerId) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!s.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!s.moved) {
      s.moved = true;
      document.body.classList.add("devlog-dragging");
      if (s.kind === "card") {
        setDragCardId(s.key);
        const note = notes.find((n) => n.id === s.key);
        const g = s.grab;
        if (note && g) {
          setDragGhost({ note, w: g.w, h: g.h, offsetX: g.offsetX, offsetY: g.offsetY, x: e.clientX, y: e.clientY });
        }
      } else {
        setDragColKey(s.key);
      }
    }
    s.curX = e.clientX;
    s.curY = e.clientY;
    if (s.kind === "card" && s.grab && ghostRef.current) {
      const g = s.grab;
      const x = e.clientX - g.offsetX;
      const y = e.clientY - g.offsetY;
      const rot = Math.max(-6, Math.min(6, (e.clientX - s.startX) * 0.18));
      ghostRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rot}deg) scale(1.02)`;
    }
    e.preventDefault();
    const b = boardRef.current;
    if (b) {
      const r = b.getBoundingClientRect();
      if (e.clientX <= r.left + AUTO_SCROLL_ZONE) startAutoScroll(-1);
      else if (e.clientX >= r.right - AUTO_SCROLL_ZONE) startAutoScroll(1);
      else startAutoScroll(0);
    }
    updateDragTarget();
  };

  function cleanupDrag() {
    startAutoScroll(0);
    document.body.classList.remove("devlog-dragging");
    dragRef.current = null;
    setDragColKey(null);
    setDragCardId(null);
    setReorderTarget(null);
    setCardDropKey(null);
    setDragGhost(null);
  }

  const handleUp = (e: PointerEvent) => {
    const s = dragRef.current;
    if (!s || s.pointerId !== e.pointerId) return;
    if (s.moved) {
      e.preventDefault();
      if (s.kind === "col") {
        const t = reorderCandidate(e.clientX, e.clientY);
        if (t && t.key !== s.key) applyReorder(s.key, t.key, t.side);
      } else {
        const hit = findColumnAt(e.clientX, e.clientY);
        if (hit) {
          const col = colById[hit];
          onProgressChange(s.key, col ? col.progressId : undefined);
        }
      }
      // 拖拽结束的“残余 click”不应打开笔记；下一次 pointerdown 时复位
      suppressClickRef.current = true;
    }
    cleanupDrag();
  };

  const handleCancel = (e: PointerEvent) => {
    const s = dragRef.current;
    if (!s || s.pointerId !== e.pointerId) return;
    cleanupDrag();
  };

  const moveRef = useRef<(e: PointerEvent) => void>(() => {});
  const upRef = useRef<(e: PointerEvent) => void>(() => {});
  const cancelRef = useRef<(e: PointerEvent) => void>(() => {});
  moveRef.current = handleMove;
  upRef.current = handleUp;
  cancelRef.current = handleCancel;

  useEffect(() => {
    const m = (e: PointerEvent) => moveRef.current(e);
    const u = (e: PointerEvent) => upRef.current(e);
    const c = (e: PointerEvent) => cancelRef.current(e);
    window.addEventListener("pointermove", m);
    window.addEventListener("pointerup", u);
    window.addEventListener("pointercancel", c);
    return () => {
      window.removeEventListener("pointermove", m);
      window.removeEventListener("pointerup", u);
      window.removeEventListener("pointercancel", c);
      startAutoScroll(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleColPointerDown(e: ReactPointerEvent<HTMLDivElement>, key: string) {
    if (e.button !== 0) return;
    suppressClickRef.current = false;
    dragRef.current = {
      kind: "col", key, pointerId: e.pointerId,
      startX: e.clientX, startY: e.clientY, curX: e.clientX, curY: e.clientY, moved: false,
    };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  function handleCardPointerDown(e: ReactPointerEvent<HTMLDivElement>, noteId: string) {
    if (e.button !== 0) return;
    const el = e.target as HTMLElement;
    if (el.closest("button, input, select, textarea, a")) return;
    suppressClickRef.current = false;
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      kind: "card", key: noteId, pointerId: e.pointerId,
      startX: e.clientX, startY: e.clientY, curX: e.clientX, curY: e.clientY, moved: false,
      grab: {
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        w: rect.width,
        h: rect.height,
      },
    };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  /* 拖拽后的残余 click 不触发打开笔记 */
  function openNote(note: DevlogNote) {
    if (suppressClickRef.current) return;
    onOpenNote(note);
  }

  return (
    <div className="devlog-board" ref={boardRef}>
      {columns.map((col) => {
        const noteList = colNotes[col.key] ?? [];
        const classes = ["devlog-board-column"];
        if (col.key === NO_STATUS_KEY) classes.push("devlog-board-column--none");
        if (dragColKey === col.key) classes.push("is-dragging");
        if (reorderTarget && reorderTarget.key === col.key) {
          classes.push(reorderTarget.side === "before" ? "is-before" : "is-after");
        }
        if (cardDropKey === col.key) classes.push("is-drop");
        return (
          <div
            key={col.key}
            className={classes.join(" ")}
            style={{ "--devlog-col": col.color } as CSSProperties}
            ref={(el) => {
              if (el) colRefs.current.set(col.key, el);
              else colRefs.current.delete(col.key);
            }}
          >
            {/* 标题淡色层（其底边随下方卡片区圆角矩形的圆角走） */}
            <div className="devlog-board-col-tint" aria-hidden />
            {/* 列头：淡色底 + 列色标题，按住拖动可调整顺序 */}
            <div
              className="devlog-board-col-header"
              onPointerDown={(e) => handleColPointerDown(e, col.key)}
              title="按住拖动调整列顺序"
            >
              <span className="devlog-board-col-name">{col.name}</span>
              <span className="devlog-board-col-count">{noteList.length}</span>
              <svg className="devlog-board-col-grip" width="10" height="14" viewBox="0 0 10 16" fill="currentColor" aria-hidden>
                <circle cx="3" cy="3" r="1.2" /><circle cx="7" cy="3" r="1.2" />
                <circle cx="3" cy="8" r="1.2" /><circle cx="7" cy="8" r="1.2" />
                <circle cx="3" cy="13" r="1.2" /><circle cx="7" cy="13" r="1.2" />
              </svg>
            </div>

            {/* 列体：卡片按时间排列 */}
            <div className="devlog-board-col-body">
              {noteList.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  tags={tags}
                  progressList={progressList}
                  dragging={dragCardId === note.id}
                  onDragPointerDown={(e) => handleCardPointerDown(e, note.id)}
                  onClick={() => openNote(note)}
                  onArchive={() => onArchiveNote(note.id)}
                  onDelete={() => onDeleteNote(note.id)}
                  onProgressChange={(pid) => onProgressChange(note.id, pid)}
                />
              ))}
              {/* {noteList.length === 0 && col.key !== NO_STATUS_KEY && (
                <div className="devlog-board-col-empty">暂无笔记</div>
              )} */}
              {/* 无状态列底部：新建笔记占位 */}
              {col.key === NO_STATUS_KEY && (
                <div className="devlog-card devlog-card--new devlog-board-new" onClick={onNewNote}>
                  <span className="devlog-card-new-label">＋ 新建笔记</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
      {dragGhost && createPortal(
        <DragGhostCard
          note={dragGhost.note}
          tags={tags}
          width={dragGhost.w}
          height={dragGhost.h}
          initialTransform={`translate3d(${dragGhost.x - dragGhost.offsetX}px, ${dragGhost.y - dragGhost.offsetY}px, 0) rotate(0deg) scale(1.02)`}
          innerRef={ghostRef}
        />,
        document.body
      )}
    </div>
  );
}
