import { useState, useRef, useEffect } from "react";

interface Props {
  currentColor: string;
  onSelect: (color: string) => void;
  onClose: () => void;
}

const PRESET_COLORS = [
  "#111827", "#6b7280", "#b91c1c", "#c2410c",
  "#b45309", "#047857", "#0369a1", "#4338ca",
  "#7c3aed", "#be185d", "#db2777", "#0f766e",
];

export function ColorPicker({ currentColor, onSelect, onClose }: Props) {
  const [custom, setCustom] = useState(currentColor);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    window.addEventListener("keydown", onKey);
    // delay to avoid immediate close on the button that opened it
    setTimeout(() => window.addEventListener("mousedown", onClick), 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [onClose]);

  return (
    <div className="rich-color-picker" ref={ref}>
      <div className="rich-color-picker-grid">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`rich-color-swatch ${currentColor === c ? "active" : ""}`}
            style={{ background: c }}
            onMouseDown={(e) => { e.preventDefault(); onSelect(c); }}
          />
        ))}
        <button
          type="button"
          className={`rich-color-swatch rich-color-swatch--default ${currentColor === "" ? "active" : ""}`}
          style={{ background: "transparent", border: "2px dashed #d1d5db" }}
          onMouseDown={(e) => { e.preventDefault(); onSelect(""); }}
          title="清除颜色"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
            <line x1="4" y1="4" x2="20" y2="20" />
          </svg>
        </button>
      </div>
      <div className="rich-color-picker-custom-row">
        <input
          type="color"
          value={custom || "#111827"}
          onChange={(e) => setCustom(e.target.value)}
          className="rich-color-custom-input"
        />
        <input
          type="text"
          className="rich-color-hex-input"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSelect(custom);
            if (e.key === "Escape") onClose();
          }}
          placeholder="#000000"
        />
        <button
          className="rich-color-apply-btn"
          onMouseDown={(e) => { e.preventDefault(); onSelect(custom); }}
        >
          应用
        </button>
      </div>
    </div>
  );
}
