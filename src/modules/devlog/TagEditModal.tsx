import { useState, useEffect, useRef } from "react";
import type { DevlogTag } from "./devlog.types";
import "./TagEditModal.css";

const COLOR_PALETTE = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c",
  "#0f766e", "#15803d", "#b45309", "#0369a1",
  "#6d28d9", "#be185d", "#0284c7", "#16a34a",
  "#d97706", "#dc2626", "#0891b2", "#7e22ce",
];

function randomColor(): string {
  return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
}

interface Props {
  tag: DevlogTag | null; // null = 新建模式
  onSave: (tag: DevlogTag) => void;
  onDelete?: () => void;  // 仅编辑模式下有效
  onClose: () => void;
}

export function TagEditModal({ tag, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(tag?.name ?? "");
  const [color, setColor] = useState(tag?.color ?? randomColor());
  const [dir, setDir] = useState(tag?.dir ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({
      id: tag?.id ?? crypto.randomUUID(),
      name: trimmed,
      color,
      pinned: tag?.pinned,
      dir: dir.trim() || undefined,
    });
  }

  return (
    <div className="tag-modal-overlay" onClick={onClose}>
      <div className="tag-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tag-modal-header">
          <span className="tag-modal-title">{tag ? "编辑标签" : "新增标签"}</span>
          <button className="tag-modal-close" onClick={onClose} aria-label="关闭">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="tag-modal-body">
            <input
              ref={inputRef}
              className="tag-modal-input"
              placeholder="标签名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="tag-modal-label">选择颜色</div>
            <div className="tag-modal-colors">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`tag-color-swatch ${color === c ? "selected" : ""}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={c}
                />
              ))}
              <div className="tag-color-custom-wrap">
                <input
                  type="color"
                  className="tag-color-custom"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  title="自定义颜色"
                />
                <span className="tag-color-custom-label">自定义</span>
              </div>
            </div>
            <div className="tag-modal-preview">
              <span
                className="devlog-tag-capsule"
                style={{
                  background: `${color}1a`,
                  color,
                  border: `1px solid ${color}50`,
                }}
              >
                {name || "预览效果"}
              </span>
            </div>

            <div className="tag-modal-label">关联目录（可选）</div>
            <div className="tag-modal-dir-row">
              <input
                className="tag-modal-input"
                type="text"
                value={dir}
                onChange={(e) => setDir(e.target.value)}
                placeholder="本地目录路径，如 D:\projects\myapp"
              />
            </div>
            {dir.trim() && (
              <p className="tag-modal-dir-hint">
                侧栏将显示快捷打开按钮，使用设置中配置的编辑器打开此目录。
              </p>
            )}
          </div>
          <div className="tag-modal-footer">
            {tag && onDelete && (
              <div className="tag-modal-delete-area">
                {confirmDelete ? (
                  <>
                    <button
                      type="button"
                      className="tag-modal-btn tag-modal-btn--danger"
                      onClick={onDelete}
                    >
                      确认删除
                    </button>
                    <button
                      type="button"
                      className="tag-modal-btn"
                      onClick={() => setConfirmDelete(false)}
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="tag-modal-btn tag-modal-btn--danger-outline"
                    onClick={() => setConfirmDelete(true)}
                  >
                    删除标签
                  </button>
                )}
              </div>
            )}
            <div className="tag-modal-footer-right">
              <button type="button" className="tag-modal-btn" onClick={onClose}>
                取消
              </button>
              <button
                type="submit"
                className="tag-modal-btn tag-modal-btn--primary"
                disabled={!name.trim()}
              >
                {tag ? "保存" : "添加"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
