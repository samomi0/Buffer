import { useState, useRef, useEffect } from "react";

interface Props {
  onSelect: (rows: number, cols: number) => void;
  onClose: () => void;
}

const MAX_ROWS = 10;
const MAX_COLS = 10;

export function TableGridPicker({ onSelect, onClose }: Props) {
  const [hoverRow, setHoverRow] = useState(0);
  const [hoverCol, setHoverCol] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    window.addEventListener("keydown", onKey);
    setTimeout(() => window.addEventListener("mousedown", onClick), 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [onClose]);

  function handleMouseEnter(row: number, col: number) {
    setHoverRow(row);
    setHoverCol(col);
  }

  function handleClick(row: number, col: number) {
    onSelect(row + 1, col + 1);
  }

  return (
    <div className="rich-table-picker" ref={ref}>
      <div className="rich-table-picker-label">
        {hoverRow > 0 || hoverCol > 0
          ? `${hoverRow + 1} × ${hoverCol + 1} 表格`
          : "选择表格大小"}
      </div>
      <div className="rich-table-grid-picker">
        {Array.from({ length: MAX_ROWS }, (_, r) => (
          <div key={r} className="rich-table-picker-row">
            {Array.from({ length: MAX_COLS }, (_, c) => (
              <button
                key={c}
                type="button"
                className={`rich-table-picker-cell ${r <= hoverRow && c <= hoverCol ? "highlight" : ""}`}
                onMouseEnter={() => handleMouseEnter(r, c)}
                onMouseDown={(e) => { e.preventDefault(); handleClick(r, c); }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
