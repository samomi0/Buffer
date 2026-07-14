import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { ColorPicker } from "./ColorPicker";
import { TableGridPicker } from "./TableGridPicker";
import "./RichTextEditor.css";

/* ── Syntax highlighting ─────────────────────────────────────── */
const lowlight = createLowlight(common);
// Register common languages
try { lowlight.register("javascript", common.javascript); } catch {}
try { lowlight.register("typescript", common.javascript); } catch {}
try { lowlight.register("js", common.javascript); } catch {}
try { lowlight.register("ts", common.javascript); } catch {}
try { lowlight.register("json", common.json); } catch {}
try { lowlight.register("css", common.css); } catch {}
try { lowlight.register("html", common.html); } catch {}
try { lowlight.register("xml", common.xml); } catch {}
try { lowlight.register("python", common.python); } catch {}
try { lowlight.register("py", common.python); } catch {}
try { lowlight.register("sql", common.sql); } catch {}
try { lowlight.register("shell", common.shell); } catch {}
try { lowlight.register("bash", common.bash); } catch {}
try { lowlight.register("sh", common.bash); } catch {}
try { lowlight.register("cpp", common.cpp); } catch {}
try { lowlight.register("c", common.cpp); } catch {}
try { lowlight.register("java", common.java); } catch {}
try { lowlight.register("rust", common.rust); } catch {}
try { lowlight.register("rs", common.rust); } catch {}
try { lowlight.register("yaml", common.yaml); } catch {}
try { lowlight.register("yml", common.yaml); } catch {}
try { lowlight.register("markdown", common.markdown); } catch {}
try { lowlight.register("md", common.markdown); } catch {}

/* ── Link colours ─────────────────────────────────────────────── */
const LINK_COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c",
  "#0f766e", "#15803d", "#b45309", "#0369a1",
];
function randomLinkColor() {
  return LINK_COLORS[Math.floor(Math.random() * LINK_COLORS.length)];
}

/* ── Link popover state ───────────────────────────────────────── */
interface LinkPopover {
  visible: boolean;
  x: number;
  y: number;
  href: string;
  color: string;
}

/* ── Props ────────────────────────────────────────────────────── */
export interface RichTextEditorProps {
  initialContent: object;
  onChange: (content: object) => void;
  placeholder?: string;
  hideLinkToolbar?: boolean;
  hideTableToolbar?: boolean;
  hideCodeToolbar?: boolean;
  extraExtensions?: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  // Devlog-specific callbacks (optional)
  onImagePaste?: (blob: File) => void;
  onLinkPaste?: (links: { href: string; label: string }[]) => void;
  onImageUrlPaste?: (urls: string[]) => void;
  dataDir?: string;
  noteId?: string;
}

export function RichTextEditor({
  initialContent, onChange, placeholder, hideLinkToolbar,
  hideTableToolbar, hideCodeToolbar, extraExtensions,
  onImagePaste, onLinkPaste, onImageUrlPaste, dataDir, noteId,
}: RichTextEditorProps) {
  const [linkPopover, setLinkPopover] = useState<LinkPopover>({
    visible: false, x: 0, y: 0, href: "", color: LINK_COLORS[0],
  });
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [linkColorChoice, setLinkColorChoice] = useState(randomLinkColor);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        // Disable default codeBlock so we can use CodeBlockLowlight instead
        codeBlock: false,
      }),
      TaskList,
      TaskItem.configure({ nested: false }),
      Underline,
      TextStyle,
      Color,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      CodeBlockLowlight.configure({ lowlight, defaultLanguage: "plaintext" }),
      Placeholder.configure({ placeholder: placeholder ?? "开始输入..." }),
      ...(extraExtensions ?? []),
    ],
    content: initialContent,
    onUpdate: ({ editor: e }) => onChange(e.getJSON()),
    editorProps: {
      transformPastedHTML(html: string) {
        // Strip <a> and <img> tags, keep inner text
        return html
          .replace(/<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>[\s\S]*?<\/a>/gi, "")
          .replace(/<img\b[^>]*\/?>/gi, "");
      },
      handlePaste: (_view, event) => {
        // Extract links and images from pasted HTML → devlog panels
        const rawHtml = event.clipboardData?.getData("text/html") ?? "";
        if (rawHtml) {
          if (onLinkPaste) {
            const links: { href: string; label: string }[] = [];
            const re = /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
            let m: RegExpExecArray | null;
            while ((m = re.exec(rawHtml)) !== null) {
              const h = m[1] || m[2] || "";
              const label = (m[3] || "").replace(/<[^>]+>/g, "").trim() || h;
              if (h) links.push({ href: h, label });
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

        // Image file paste
        const items = Array.from(event.clipboardData?.items ?? []);
        const imgItem = items.find((i) => i.type.startsWith("image/"));
        if (!imgItem) return false;
        const blob = imgItem.getAsFile();
        if (!blob) return false;

        if (onImagePaste) {
          onImagePaste(blob);
          return true;
        }
        return false;
      },
    },
  });

  /* ── Link click → open externally ──────────────────────────── */
  function handleEditorClick(e: React.MouseEvent<HTMLDivElement>) {
    const anchor = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
    if (!anchor) return;
    e.preventDefault();
    const href = anchor.getAttribute("href");
    if (href) {
      import("@tauri-apps/plugin-shell").then(({ open }) => open(href)).catch(() => {});
    }
  }

  /* ── Right-click on link → edit popover ─────────────────────── */
  function handleContextMenu(e: React.MouseEvent<HTMLDivElement>) {
    const anchor = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
    if (!anchor) return;
    e.preventDefault();
    const color = anchor.getAttribute("data-link-color") || LINK_COLORS[0];
    setLinkPopover({
      visible: true, x: e.clientX, y: e.clientY,
      href: anchor.getAttribute("href") || "", color,
    });
  }

  /* ── Apply edited link from popover ─────────────────────────── */
  function applyLinkPopover() {
    if (!editor || !linkPopover.href) return;
    editor.chain().focus()
      .extendMarkRange("link")
      .setMark("link", { href: linkPopover.href, color: linkPopover.color })
      .run();
    setLinkPopover((p) => ({ ...p, visible: false }));
  }

  /* ── Insert new link from toolbar ───────────────────────────── */
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
      const textNode = schema.text(href, [mark]);
      editor.view.dispatch(tr.replaceWith(selection.from, selection.to, textNode));
    } else {
      const markStep = tr.addMark(selection.from, selection.to, mark);
      editor.view.dispatch(markStep);
    }
    editor.view.focus();
    setLinkInput("");
    setLinkColorChoice(randomLinkColor());
    setShowLinkInput(false);
  }

  /* ── Insert table ───────────────────────────────────────────── */
  function insertTable(rows: number, cols: number) {
    if (!editor) return;
    editor.chain().focus()
      .insertTable({ rows, cols, withHeaderRow: true })
      .run();
    setShowTablePicker(false);
  }

  /* ── Apply text color ───────────────────────────────────────── */
  function applyColor(color: string) {
    if (!editor) return;
    if (color) {
      editor.chain().focus().setColor(color).run();
    } else {
      editor.chain().focus().unsetColor().run();
    }
    setShowColorPicker(false);
  }

  if (!editor) return null;

  return (
    <>
    <div className="rich-editor-wrapper">
      {/* ── Toolbar ────────────────────────────────────────────── */}
      <div className="rich-toolbar">
        {/* Group 1: Text styles */}
        <button
          className={`rich-toolbar-btn ${editor.isActive("bold") ? "active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
          title="加粗 (Ctrl+B)"
        ><strong>B</strong></button>
        <button
          className={`rich-toolbar-btn ${editor.isActive("italic") ? "active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
          title="斜体 (Ctrl+I)"
        ><em>I</em></button>
        <button
          className={`rich-toolbar-btn ${editor.isActive("underline") ? "active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}
          title="下划线 (Ctrl+U)"
        ><u>U</u></button>
        <button
          className={`rich-toolbar-btn ${editor.isActive("strike") ? "active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }}
          title="删除线"
        ><s>S</s></button>

        {/* Color picker */}
        <div className="rich-toolbar-color-area">
          <button
            className={`rich-toolbar-btn ${showColorPicker ? "active" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); setShowColorPicker((v) => !v); }}
            title="字体颜色"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2L2 20h20L12 2z" /><line x1="7" y1="15" x2="17" y2="15" />
            </svg>
          </button>
          {showColorPicker && (
            <ColorPicker
              currentColor={editor.getAttributes("textStyle").color || ""}
              onSelect={applyColor}
              onClose={() => setShowColorPicker(false)}
            />
          )}
        </div>

        <div className="rich-toolbar-sep" />

        {/* Group 2: Lists */}
        <button
          className={`rich-toolbar-btn ${editor.isActive("bulletList") ? "active" : ""}`}
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
          className={`rich-toolbar-btn ${editor.isActive("orderedList") ? "active" : ""}`}
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
          className={`rich-toolbar-btn ${editor.isActive("taskList") ? "active" : ""}`}
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

        <div className="rich-toolbar-sep" />

        {/* Group 3: Content blocks */}
        {!hideCodeToolbar && (
          <>
            <button
              className={`rich-toolbar-btn ${editor.isActive("code") ? "active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleCode().run(); }}
              title="行内代码"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="7 8L3 12l4 4" /><polyline points="17 8l4 4-4 4" /><line x1="14" y1="4" x2="10" y2="20" />
              </svg>
            </button>
            <button
              className={`rich-toolbar-btn ${editor.isActive("codeBlock") ? "active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleCodeBlock().run(); }}
              title="代码块"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M8 8l3 4-3 4M13 10l3 4-3 4" />
              </svg>
            </button>
          </>
        )}
        <button
          className="rich-toolbar-btn"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setHorizontalRule().run(); }}
          title="水平分割线"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="12" x2="20" y2="12" />
          </svg>
        </button>

        <div className="rich-toolbar-sep" />

        {/* Group 4: Insertion */}
        {!hideTableToolbar && (
          <div className="rich-toolbar-table-area">
            <button
              className={`rich-toolbar-btn ${showTablePicker ? "active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); setShowTablePicker((v) => !v); }}
              title="插入表格"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" />
                <line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" />
              </svg>
            </button>
            {showTablePicker && (
              <TableGridPicker onSelect={insertTable} onClose={() => setShowTablePicker(false)} />
            )}
          </div>
        )}

        {/* Link button */}
        {!hideLinkToolbar && (
          <div className="rich-toolbar-link-area">
            <button
              className={`rich-toolbar-btn ${showLinkInput ? "active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); setShowLinkInput((v) => !v); }}
              title="插入链接"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </button>
            {showLinkInput && (
              <div className="rich-link-input-panel">
                <input
                  className="rich-link-input"
                  placeholder="输入链接 URL..."
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); insertLink(); } if (e.key === "Escape") setShowLinkInput(false); }}
                  autoFocus
                />
                <div className="rich-link-colors">
                  {LINK_COLORS.map((c) => (
                    <button key={c} type="button"
                      className={`rich-link-color-dot ${linkColorChoice === c ? "selected" : ""}`}
                      style={{ background: c }}
                      onMouseDown={(e) => { e.preventDefault(); setLinkColorChoice(c); }}
                    />
                  ))}
                  <input type="color" className="rich-link-color-custom"
                    value={linkColorChoice} onChange={(e) => setLinkColorChoice(e.target.value)} title="自定义颜色"
                  />
                </div>
                <button className="rich-link-confirm-btn" onMouseDown={(e) => { e.preventDefault(); insertLink(); }}>
                  确认
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Editor content ─────────────────────────────────────── */}
      <div className="rich-editor-content" onClick={handleEditorClick} onContextMenu={handleContextMenu}>
        <EditorContent editor={editor} />
      </div>

      {/* ── Link right-click popover ────────────────────────────── */}
      {linkPopover.visible && (
        <>
          <div className="rich-popover-backdrop"
            onClick={() => setLinkPopover((p) => ({ ...p, visible: false }))}
          />
          <div className="rich-link-popover" style={{ top: linkPopover.y, left: linkPopover.x }}>
            <div className="rich-link-popover-title">
              编辑链接
              <button className="rich-link-popover-close"
                onClick={() => setLinkPopover((p) => ({ ...p, visible: false }))}>×</button>
            </div>
            <input className="rich-link-input" value={linkPopover.href}
              onChange={(e) => setLinkPopover((p) => ({ ...p, href: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && applyLinkPopover()} autoFocus
            />
            <div className="rich-link-colors">
              {LINK_COLORS.map((c) => (
                <button key={c} type="button"
                  className={`rich-link-color-dot ${linkPopover.color === c ? "selected" : ""}`}
                  style={{ background: c }}
                  onMouseDown={(e) => { e.preventDefault(); setLinkPopover((p) => ({ ...p, color: c })); }}
                />
              ))}
              <input type="color" className="rich-link-color-custom"
                value={linkPopover.color} onChange={(e) => setLinkPopover((p) => ({ ...p, color: e.target.value }))}
                title="自定义颜色"
              />
            </div>
            <button className="rich-link-confirm-btn"
              onMouseDown={(e) => { e.preventDefault(); applyLinkPopover(); }}>
              确认
            </button>
          </div>
        </>
      )}
    </div>
    </>
  );
}
