import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { getCurrentWindow, type Window } from "@tauri-apps/api/window";

/**
 * 是否运行在 Tauri WebView 中（否则为纯浏览器预览，窗口 API 不可用）。
 */
export function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window
  );
}

export interface WindowChrome {
  /** 是否处于 Tauri 运行环境 */
  isTauri: boolean;
  /** 窗口当前是否最大化（决定 最大化/还原 图标） */
  isMaximized: boolean;
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
  /**
   * 标题栏拖动处理：绑定到标题栏元素的 onMouseDown。
   * 交互控件（button/a/input 等）不触发；空白处拖动窗口、双击最大化/还原。
   */
  onTitlebarMouseDown: (e: ReactMouseEvent) => void;
}

/**
 * 无边框窗口（decorations:false）所需的窗口控制逻辑。
 * 在纯浏览器中运行时不抛错、不生效。
 */
export function useWindowChrome(): WindowChrome {
  const isTauri = isTauriRuntime();
  const [isMaximized, setIsMaximized] = useState(false);
  const winRef = useRef<Window | null>(null);

  const win = useCallback(() => {
    if (!winRef.current) {
      winRef.current = getCurrentWindow();
    }
    return winRef.current;
  }, []);

  // 初始化最大化状态，并监听 resize 保持同步（最大化/还原会触发 resize）
  useEffect(() => {
    if (!isTauri) return;
    let alive = true;
    let unlisten: (() => void) | undefined;

    (async () => {
      try {
        const w = win();
        if (alive) {
          setIsMaximized(await w.isMaximized());
        }
        unlisten = await w.onResized(() => {
          w.isMaximized()
            .then((v) => {
              if (alive) setIsMaximized(v);
            })
            .catch(() => {});
        });
      } catch {
        /* 非窗口环境忽略 */
      }
    })();

    return () => {
      alive = false;
      unlisten?.();
    };
  }, [isTauri, win]);

  const minimize = useCallback(() => {
    if (isTauri) {
      win()
        .minimize()
        .catch(() => {});
    }
  }, [isTauri, win]);

  const toggleMaximize = useCallback(() => {
    if (isTauri) {
      win()
        .toggleMaximize()
        .catch(() => {});
    }
  }, [isTauri, win]);

  const close = useCallback(() => {
    if (isTauri) {
      win()
        .close()
        .catch(() => {});
    }
  }, [isTauri, win]);

  const onTitlebarMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      if (!isTauri) return;
      if (e.button !== 0) return;

      const target = e.target as HTMLElement | null;
      if (!target || typeof target.closest !== "function") return;

      // 交互控件不参与窗口拖动
      if (
        target.closest(
          "button, a, input, select, textarea, [contenteditable], [data-no-drag]",
        )
      ) {
        return;
      }

      // 双击标题栏空白处 → 最大化 / 还原
      if (e.detail >= 2) {
        toggleMaximize();
        return;
      }

      e.preventDefault();
      win()
        .startDragging()
        .catch(() => {});
    },
    [isTauri, win, toggleMaximize],
  );

  return {
    isTauri,
    isMaximized,
    minimize,
    toggleMaximize,
    close,
    onTitlebarMouseDown,
  };
}
