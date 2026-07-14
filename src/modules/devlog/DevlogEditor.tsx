import { ReactNodeViewRenderer } from "@tiptap/react";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { RichTextEditor } from "../../core/components/RichTextEditor";
import { DevlogImageNode } from "./DevlogImageNode";

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasImage = (s: any) => {
      let found = false;
      s.doc.nodesBetween(s.selection.from, s.selection.to, (node: { type: { name: string } }) => {
        if (node.type.name === "image") found = true;
      });
      return found;
    };
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Backspace: ({ editor }: any) => {
        const s = editor.state;
        if (hasImage(s)) return true;
        if (s.selection.empty) {
          const $pos = s.doc.resolve(s.selection.from);
          if ($pos.nodeBefore?.type?.name === "image") return true;
        }
        return false;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Delete: ({ editor }: any) => {
        const s = editor.state;
        if (hasImage(s)) return true;
        if (s.selection.empty) {
          const $pos = s.doc.resolve(s.selection.from);
          if ($pos.nodeAfter?.type?.name === "image") return true;
        }
        return false;
      },
    };
  },
});

/* ── Props (unchanged) ────────────────────────────────────────── */
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

export function DevlogEditor({
  initialContent, dataDir: _dataDir, noteId: _noteId, onChange, hideLinkToolbar,
  onImagePaste, onLinkPaste, onImageUrlPaste,
}: Props) {
  return (
    <RichTextEditor
      initialContent={initialContent}
      onChange={onChange}
      placeholder="开始记录..."
      hideLinkToolbar={hideLinkToolbar}
      extraExtensions={[
        CustomLink.configure({
          openOnClick: false,
          HTMLAttributes: { rel: "noopener noreferrer", class: "devlog-link" },
        }),
        DevlogImage.configure({ inline: false }),
      ]}
      onImagePaste={onImagePaste}
      onLinkPaste={onLinkPaste}
      onImageUrlPaste={onImageUrlPaste}
    />
  );
}
