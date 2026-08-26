import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useAppStore } from "../../core/stores/appStore";
import {
  termCreate,
  termWrite,
  termResize,
  termClose,
  termList,
  termAttach,
  termDetectShell,
} from "./terminal";
import "@xterm/xterm/css/xterm.css";
import "./TerminalPage.css";

let shellCache: string | null = null;

/**
 * 模块级初始化单例：StrictMode 下 effect 会执行两次，
 * 通过共享同一个 Promise 保证只创建一次首个终端。
 */
const initState: { promise: Promise<string[] | null> | null } = { promise: null };

function startInit(createBackend: (id: string) => Promise<void>): Promise<string[] | null> {
  if (!initState.promise) {
    initState.promise = (async () => {
      try {
        let list = await termList();
        if (list.length === 0) {
          const id = crypto.randomUUID();
          await createBackend(id);
          list = [id];
        }
        return list;
      } catch {
        return null;
      }
    })();
  }
  return initState.promise;
}

export function TerminalPage() {
  const closeTool = useAppStore((s) => s.closeTool);
  const terminalConfig = useAppStore((s) => s.terminalConfig);

  const [ids, setIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<{ term: Terminal; fit: FitAddon } | null>(null);
  const outputUnlistenRef = useRef<UnlistenFn | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const activeIdRef = useRef<string | null>(null);
  /** attach 序号：用于让过期的异步 attach（如 StrictMode 双执行）自我失效 */
  const attachSeqRef = useRef(0);
  const busyRef = useRef(false);

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

  const detachTerm = useCallback(() => {
    attachSeqRef.current += 1; // 使进行中的异步 attach 失效
    outputUnlistenRef.current?.();
    outputUnlistenRef.current = null;
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;
    termRef.current?.term.dispose();
    termRef.current = null;
  }, []);

  const attachTerm = useCallback(
    async (id: string, container: HTMLDivElement) => {
      detachTerm();
      const seq = attachSeqRef.current;
      activeIdRef.current = id;

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        lineHeight: 1.3,
        fontFamily: '"Cascadia Code", "JetBrains Mono", "Fira Code", Consolas, monospace',
        scrollback: 5000,
        theme: {
          background: "#ffffff",
          foreground: "#1f2937",
          cursor: "#2563eb",
          cursorAccent: "#ffffff",
          selectionBackground: "rgba(37, 99, 235, 0.22)",
          black: "#1f2937",
          red: "#dc2626",
          green: "#16a34a",
          yellow: "#d97706",
          blue: "#2563eb",
          magenta: "#7c3aed",
          cyan: "#0891b2",
          white: "#e5e7eb",
          brightBlack: "#9ca3af",
          brightRed: "#ef4444",
          brightGreen: "#22c55e",
          brightYellow: "#f59e0b",
          brightBlue: "#3b82f6",
          brightMagenta: "#a78bfa",
          brightCyan: "#06b6d4",
          brightWhite: "#ffffff",
        },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(container);
      try {
        fit.fit();
      } catch {
        /* 容器尚未布局完成时忽略，ResizeObserver 会再次触发 */
      }
      termRef.current = { term, fit };

      term.onData((data) => {
        void termWrite(id, data);
      });
      term.onResize(({ cols, rows }) => {
        void termResize(id, cols, rows);
      });

      const unlisten = await listen("term-output", (e) => {
        if (attachSeqRef.current !== seq) return; // 过期 attach 忽略
        const p = e.payload as { id: string; data: string };
        if (p.id === activeIdRef.current) {
          termRef.current?.term.write(p.data);
        }
      });
      if (attachSeqRef.current !== seq) {
        unlisten(); // 已被更新的 attach 取代
        return;
      }
      outputUnlistenRef.current = unlisten;

      // 回放历史输出
      try {
        const buffer = await termAttach(id);
        if (attachSeqRef.current === seq && buffer) term.write(buffer);
      } catch {
        /* ignore */
      }

      const ro = new ResizeObserver(() => {
        try {
          fit.fit();
        } catch {
          /* ignore */
        }
      });
      ro.observe(container);
      resizeObserverRef.current = ro;
    },
    [detachTerm],
  );

  const resolveShell = useCallback(async (): Promise<string> => {
    if (terminalConfig.shellPath?.trim()) return terminalConfig.shellPath.trim();
    if (!shellCache) {
      try {
        shellCache = (await termDetectShell()) || "bash";
      } catch {
        shellCache = "bash";
      }
    }
    return shellCache;
  }, [terminalConfig.shellPath]);

  const createBackend = useCallback(
    async (id: string) => {
      const shell = await resolveShell();
      await termCreate(id, {
        shell,
        cwd: terminalConfig.cwd?.trim() || undefined,
        cols: 80,
        rows: 24,
      });
    },
    [resolveShell, terminalConfig.cwd],
  );

  /* ── 初始化：恢复已有会话或自动创建第一个 ───────────────── */
  useEffect(() => {
    let cancelled = false;
    void startInit(createBackend)
      .then((list) => {
        if (cancelled || !list) return;
        setIds(list);
        setActiveId(list[0]);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [createBackend]);

  /* ── 激活会话变化时挂载/卸载 xterm ──────────────────────── */
  useEffect(() => {
    if (!ready || !activeId) return;
    const container = containerRef.current;
    if (!container) return;
    void attachTerm(activeId, container);
    return () => detachTerm();
  }, [ready, activeId, attachTerm, detachTerm]);

  const handleNew = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setError(null);
    try {
      const id = crypto.randomUUID();
      await createBackend(id);
      setIds((prev) => [...prev, id]);
      setActiveId(id);
    } catch (e) {
      setError(String(e));
    } finally {
      busyRef.current = false;
    }
  };

  const handleClose = async (id: string) => {
    try {
      await termClose(id);
    } catch {
      /* ignore */
    }
    const next = ids.filter((i) => i !== id);
    setIds(next);
    if (activeId === id) {
      setActiveId(next[0] ?? null);
    }
  };

  return (
    <div className="term-shell">
      <div className="term-tabs">
        {ids.map((id, idx) => (
          <div
            key={id}
            className={`term-tab ${activeId === id ? "active" : ""}`}
            onClick={() => setActiveId(id)}
          >
            <span className="term-tab-name">终端 {idx + 1}</span>
            <button
              className="term-tab-close"
              title="关闭终端"
              onClick={(e) => {
                e.stopPropagation();
                void handleClose(id);
              }}
            >
              <CloseIcon />
            </button>
          </div>
        ))}
        <button className="term-tab-new" title="新建终端" onClick={() => void handleNew()}>
          <PlusIcon /> 新建
        </button>
        <span className="term-tabs-hint">Ctrl+K 返回</span>
      </div>

      {error && <div className="term-error">{error}</div>}

      <div className="term-body">
        {ready && activeId ? (
          <div className="term-pane" ref={containerRef} />
        ) : ready ? (
          <div className="term-empty">
            <div className="term-empty-icon"><TerminalIcon /></div>
            <p>没有终端会话</p>
            <button className="term-empty-btn" onClick={() => void handleNew()}>
              <PlusIcon /> 新建终端
            </button>
          </div>
        ) : (
          <div className="term-empty">
            <div className="term-empty-icon"><TerminalIcon /></div>
            <p>正在创建终端...</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2.5" />
      <path d="M6 9l3.5 3L6 15" />
      <path d="M11.5 15H18" />
    </svg>
  );
}
