import { useState } from "react";
import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { DevlogImageNode } from "./DevlogImageNode";

/* ── Link colours ─────────────────────────────────────────────── */
const LINK_COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c",
  "#0f766e", "#15803d", "#b45309", "#0369a1",
];
function randomLinkColor() {
  return LINK_COLORS[Math.floor(Math.random() * LINK_COLORS.length)];
}

/* ── Extended Link — adds `color` attribute ───────────────────── */
const CustomLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      color: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-link-color"),
        renderHTML: (attrs) => {
          if (!attrs.color) return {};
          const c: string = attrs.color;
          return {
            "data-link-color": c,
            style: `color:${c};border-color:${c}55;background:${c}14`,
          };
        },
      },
    };
  },
});

/* ── Extended Image — React NodeView ──────────────────────────── */
const DevlogImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(DevlogImageNode);
  },
  addKeyboardShortcuts() {
    const hasImage = (state: { doc: { nodesBetween: (f: number, t: number, fn: (n: { type: { name: string } }) => void) => void }; selection: { from: number; to: number } }) => {
      let found = false;
      state.doc.nodesBetween(state.selection.from, state.selection.to, (node) => {
        if (node.type.name === "image") found = true;
      });
      return found;
    };
    return {
      Backspace: ({ editor }) => {
        const { state } = editor;
        if (hasImage(state)) return true;
        if (state.selection.empty) {
          const $pos = state.doc.resolve(state.selection.from);
          if (($pos.nodeBefore as { type?: { name?: string } } | null)?.type?.name === "image") return true;
        }
        return false;
      },
      Delete: ({ editor }) => {
        const { state } = editor;
        if (hasImage(state)) return true;
        if (state.selection.empty) {
          const $pos = state.doc.resolve(state.selection.from);
          if (($pos.nodeAfter as { type?: { name?: string } } | null)?.type?.name === "image") return true;
        }
        return false;
      },
    };
  },
});

/* ── Link popover state ───────────────────────────────────────── */
interface LinkPopover {
  visible: boolean;
  x: number;
  y: number;
  href: string;
  color: string;
}

interface Props {
  initialContent: object;
  dataDir: string;
  noteId: string;
  onChange: (content: object) => void;
  hideLinkToolbar?: boolean;
  onImagePaste?: (blob: File) => void;
  onLinkPaste?: (links: { href: string; label: string }[]) => void;
  onImageUrlPaste?: (urls: string[]) => void;
}

/* ── 先存后插：回调内等待写盘完成再插入节点，不含 data URL ──── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pasteImage(
  blob: File,
  editorView: any,
  dataDir: string,
  noteId: string,
) {
  try {
    // 读取 base64
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    // 存入磁盘
    const { saveDevlogImage } = await import("./useDevlog");
    const relativePath = await saveDevlogImage(dataDir, noteId, dataUrl);
    // 先取位置再创建节点
    const pos = editorView.state.selection.from;
    const { schema, tr } = editorView.state;
    const imageNode = schema.nodes.image?.create({ src: relativePath });
    if (imageNode) {
      editorView.dispatch(tr.replaceWith(pos, pos, imageNode) as never);
    }
  } catch (e) {
    console.error("图片粘贴失败", e);
  }
}

export function DevlogEditor({ initialContent, dataDir, noteId, onChange, hideLinkToolbar, onImagePaste, onLinkPaste, onImageUrlPaste }: Props) {
  const [linkPopover, setLinkPopover] = useState<LinkPopover>({
    visible: false, x: 0, y: 0, href: "", color: LINK_COLORS[0],
  });
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [linkColorChoice, setLinkColorChoice] = useState(randomLinkColor);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      TaskList,
      TaskItem.configure({ nested: false }),
      CustomLink.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", class: "devlog-link" },
      }),
      DevlogImage.configure({ inline: false }),
      Placeholder.configure({ placeholder: "开始记录..." }),
    ],
    content: initialContent,
    onUpdate: ({ editor: e }) => onChange(e.getJSON()),
    editorProps: {
      transformPastedHTML(html: string) {
        // 剥离 <a> 和 <img>，不保留内部文本
        return html
          .replace(/<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>[\s\S]*?<\/a>/gi, "")
          .replace(/<img\b[^>]*\/?>/gi, "");
      },
      handlePaste: (_view, event) => {
        // 从原始剪贴板 HTML 提取链接和图片，分发到面板回调
        const rawHtml = event.clipboardData?.getData("text/html") ?? "";
        if (rawHtml) {
          if (onLinkPaste) {
            const links: { href: string; label: string }[] = [];
            const re = /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
            let m: RegExpExecArray | null;
            while ((m = re.exec(rawHtml)) !== null) {
              const href = m[1] || m[2] || "";
              const label = (m[3] || "").replace(/<[^>]+>/g, "").trim() || href;
              if (href) links.push({ href, label });
            }
            if (links.length > 0) onLinkPaste(links);
          }
          if (onImageUrlPaste) {
            const imgs: string[] = [];
            const re2 = /<img\b[^>]*src\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*\/?>/gi;
            let m2: RegExpExecArray | null;
            while ((m2 = re2.exec(rawHtml)) !== null) {
              const src = m2[1] || m2[2] || "";
              if (src) imgs.push(src);
            }
            if (imgs.length > 0) onImageUrlPaste(imgs);
          }
        }

        // 文件图片粘贴
        const items = Array.from(event.clipboardData?.items ?? []);
        const imgItem = items.find((i) => i.type.startsWith("image/"));
        if (!imgItem) return false;
        const blob = imgItem.getAsFile();
        if (!blob) return false;

        if (onImagePaste) {
          onImagePaste(blob);
          return true;
        }

        pasteImage(blob, _view, dataDir, noteId);
        return true;
      },
    },
  });

  /* ── Link click → open in browser ─────────────────────────── */
  function handleEditorClick(e: React.MouseEvent<HTMLDivElement>) {
    const anchor = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
    if (!anchor) return;
    e.preventDefault();
    const href = anchor.getAttribute("href");
    if (href) {
      import("@tauri-apps/plugin-shell").then(({ open }) => open(href)).catch(() => {});
    }
  }

  /* ── Right-click on link → edit popover ───────────────────── */
  function handleContextMenu(e: React.MouseEvent<HTMLDivElement>) {
    const anchor = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
    if (!anchor) return;
    e.preventDefault();
    const color = anchor.getAttribute("data-link-color") || LINK_COLORS[0];
    setLinkPopover({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      href: anchor.getAttribute("href") || "",
      color,
    });
  }

  /* ── Apply edited link from popover ───────────────────────── */
  function applyLinkPopover() {
    if (!editor || !linkPopover.href) return;
    editor.chain()
      .focus()
      .extendMarkRange("link")
      .setMark("link", { href: linkPopover.href, color: linkPopover.color })
      .run();
    setLinkPopover((p) => ({ ...p, visible: false }));
  }

  /* ── Insert new link from toolbar ─────────────────────────── */
  function insertLink() {
    if (!editor || !linkInput.trim()) {
      setShowLinkInput(false);
      return;
    }
    const rawHref = linkInput.trim();
    const href = /^https?:\/\//.test(rawHref) ? rawHref : `https://${rawHref}`;
    const color = linkColorChoice;
    const { schema, tr, selection } = editor.state;
    const linkMarkType = schema.marks.link;
    if (!linkMarkType) return;
    const mark = linkMarkType.create({ href, color });

    if (selection.empty) {
      // No selection — insert URL as linked text
      const textNode = schema.text(href, [mark]);
      editor.view.dispatch(tr.replaceWith(selection.from, selection.to, textNode));
    } else {
      // Selection exists — apply link mark to it
      const markStep = tr.addMark(selection.from, selection.to, mark);
      editor.view.dispatch(markStep);
    }
    editor.view.focus();
    setLinkInput("");
    setLinkColorChoice(randomLinkColor());
    setShowLinkInput(false);
  }

  if (!editor) return null;

  return (
    <>
    <div className={`devlog-editor-wrapper${hideLinkToolbar ? " devlog-editor-wrapper--no-media" : ""}`}>
      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="devlog-toolbar">
        <button
          className={`devlog-toolbar-btn ${editor.isActive("bold") ? "active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
          title="加粗 (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
        <button
          className={`devlog-toolbar-btn ${editor.isActive("italic") ? "active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
          title="斜体 (Ctrl+I)"
        >
          <em>I</em>
        </button>
        <button
          className={`devlog-toolbar-btn ${editor.isActive("bulletList") ? "active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
          title="无序列表"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" />
            <line x1="9" y1="18" x2="20" y2="18" />
            <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
          </svg>
        </button>
        <button
          className={`devlog-toolbar-btn ${editor.isActive("orderedList") ? "active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
          title="有序列表"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="10" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" />
            <line x1="10" y1="18" x2="20" y2="18" />
            <text x="2" y="8.5" fontSize="7" fontWeight="600" fill="currentColor" stroke="none">1.</text>
            <text x="2" y="14.5" fontSize="7" fontWeight="600" fill="currentColor" stroke="none">2.</text>
            <text x="2" y="20.5" fontSize="7" fontWeight="600" fill="currentColor" stroke="none">3.</text>
          </svg>
        </button>
        <button
          className={`devlog-toolbar-btn ${editor.isActive("taskList") ? "active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleTaskList().run(); }}
          title="待办列表"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="4" width="6" height="6" rx="1" /><polyline points="4,7 5.5,8.5 8,6" />
            <line x1="13" y1="7" x2="21" y2="7" />
            <rect x="3" y="14" width="6" height="6" rx="1" />
            <line x1="13" y1="17" x2="21" y2="17" />
          </svg>
        </button>

        <div className="devlog-toolbar-sep" />

        {/* Link button + inline input */}
        {!hideLinkToolbar && (
        <div className="devlog-toolbar-link-area">
          <button
            className={`devlog-toolbar-btn ${showLinkInput ? "active" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); setShowLinkInput((v) => !v); }}
            title="插入链接"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </button>
          {showLinkInput && (
            <div className="devlog-link-input-panel">
              <input
                className="devlog-link-input"
                placeholder="输入链接 URL..."
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); insertLink(); }
                  if (e.key === "Escape") setShowLinkInput(false);
                }}
                autoFocus
              />
              <div className="devlog-link-colors">
                {LINK_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`devlog-link-color-dot ${linkColorChoice === c ? "selected" : ""}`}
                    style={{ background: c }}
                    onMouseDown={(e) => { e.preventDefault(); setLinkColorChoice(c); }}
                  />
                ))}
                <input
                  type="color"
                  className="devlog-link-color-custom"
                  value={linkColorChoice}
                  onChange={(e) => setLinkColorChoice(e.target.value)}
                  title="自定义颜色"
                />
              </div>
              <button className="devlog-link-confirm-btn" onMouseDown={(e) => { e.preventDefault(); insertLink(); }}>
                确认
              </button>
            </div>
          )}
        </div>
        )}
      </div>

      {/* ── Editor content ───────────────────────────────────── */}
      <div
        className="devlog-editor-content"
        onClick={handleEditorClick}
        onContextMenu={handleContextMenu}
      >
        <EditorContent editor={editor} />
      </div>

      {/* ── Link right-click popover ─────────────────────────── */}
      {linkPopover.visible && (
        <>
          <div
            className="devlog-popover-backdrop"
            onClick={() => setLinkPopover((p) => ({ ...p, visible: false }))}
          />
          <div
            className="devlog-link-popover"
            style={{ top: linkPopover.y, left: linkPopover.x }}
          >
            <div className="devlog-link-popover-title">
              编辑链接
              <button
                className="devlog-link-popover-close"
                onClick={() => setLinkPopover((p) => ({ ...p, visible: false }))}
              >×</button>
            </div>
            <input
              className="devlog-link-input"
              value={linkPopover.href}
              onChange={(e) => setLinkPopover((p) => ({ ...p, href: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && applyLinkPopover()}
              autoFocus
            />
            <div className="devlog-link-colors">
              {LINK_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`devlog-link-color-dot ${linkPopover.color === c ? "selected" : ""}`}
                  style={{ background: c }}
                  onClick={() => setLinkPopover((p) => ({ ...p, color: c }))}
                />
              ))}
              <input
                type="color"
                className="devlog-link-color-custom"
                value={linkPopover.color}
                onChange={(e) => setLinkPopover((p) => ({ ...p, color: e.target.value }))}
                title="自定义颜色"
              />
            </div>
            <button className="devlog-link-confirm-btn devlog-link-confirm-btn--full" onClick={applyLinkPopover}>
              确认修改
            </button>
          </div>
        </>
      )}
    </div>
    </>
  );
}
