import { useState, useEffect, useContext, createContext } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/core";
import { loadDevlogImage } from "./useDevlog";

/* ── 内联 Context 避免模块间强依赖崩溃 ──────────────────────── */
const DevlogNodeCtx = createContext<{ dataDir: string } | null>(null);
export const DevlogNodeCtxProvider = DevlogNodeCtx.Provider;

export function DevlogImageNode({ node, deleteNode }: NodeViewProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [imgSrc, setImgSrc] = useState<string>("");
  const ctx = useContext(DevlogNodeCtx);
  const rawSrc = (typeof node.attrs.src === "string" ? node.attrs.src : "") as string;
  const isRelative = rawSrc.startsWith("images/");

  /* ── 无 Context 或非相对路径：直接显示原始 src ────────────── */
  useEffect(() => {
    if (!isRelative || !ctx) {
      setImgSrc(rawSrc);
      return;
    }
    let cancelled = false;
    loadDevlogImage(ctx.dataDir, rawSrc)
      .then((url) => { if (!cancelled) setImgSrc(url); })
      .catch((e) => console.error("图片加载失败:", rawSrc, e));
    return () => { cancelled = true; };
  }, [ctx?.dataDir, rawSrc, isRelative]);

  function handleZoom(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    document.dispatchEvent(
      new CustomEvent("devlog:image-zoom", { detail: { src: imgSrc } })
    );
  }

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
    <NodeViewWrapper className="devlog-image-wrapper" contentEditable={false}>
      <div className="devlog-image-container">
        <img
          src={imgSrc}
          className="devlog-image-thumb"
          onClick={handleZoom}
          onContextMenu={handleContextMenu}
          draggable={false}
          alt=""
        />
        {confirmDelete ? (
          <div className="devlog-image-confirm-row">
            <button
              className="devlog-image-btn devlog-image-btn--danger"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => deleteNode()}
            >
              确认删除
            </button>
            <button
              className="devlog-image-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setConfirmDelete(false)}
            >
              取消
            </button>
          </div>
        ) : (
          <button
            className="devlog-image-delete-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(true);
            }}
            title="删除图片"
          >
            ×
          </button>
        )}
      </div>
    </NodeViewWrapper>
  );
}
