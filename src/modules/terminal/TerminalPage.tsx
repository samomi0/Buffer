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
 * 首次终端的自动创建去重：StrictMode 下初始化 effect 会执行两次，
 * 通过共享同一个进行中的 Promise 保证只创建一个；创建完成后立即清空，
 * 避免返回已删除的过期 id（删除/新建终端后重进页面必须重新查询后端）。
 */
let autoCreatePromise: Promise<string | null> | null = null;

async function ensureFirstTerminal(
  createBackend: (id: string) => Promise<void>,
): Promise<string | null> {
  if (!autoCreatePromise) {
    autoCreatePromise = (async () => {
      try {
        const existing = await termList();
        if (existing.length > 0) return null;
        const id = crypto.randomUUID();
        await createBackend(id);
        return id;
      } catch {
        return null;
      }
    })().finally(() => {
      autoCreatePromise = null;
    });
  }
  return autoCreatePromise;
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

      // 回放历史输出时，xterm 会对缓冲里的终端查询序列（如 ESC[6n 光标位置查询）
      // 自动应答（ESC[行;列R），这些应答经 onData 转发给后端会变成多余输入
      // （表现为重进终端页后输入行多出一个 "R"）。回放期间屏蔽 onData 转发。
      // 注意：xterm 的 write 是异步批处理（WriteBuffer 经 setTimeout 才解析），
      // 因此必须等 onWriteParsed 确认回放真正解析完成后再恢复转发。
      let replaying = false;
      term.onData((data) => {
        if (replaying) return;
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

      // 回放历史输出，回放期间的自动应答一并丢弃
      try {
        const buffer = await termAttach(id);
        if (attachSeqRef.current === seq && buffer) {
          const replayDone = new Promise<void>((resolve) => {
            const sub = term.onWriteParsed(() => {
              sub.dispose();
              resolve();
            });
          });
          replaying = true;
          term.write(buffer);
          // 兜底超时：attach 被取代或极端情况下 onWriteParsed 不触发时避免悬挂
          await Promise.race([
            replayDone,
            new Promise<void>((resolve) => window.setTimeout(resolve, 1000)),
          ]);
          if (attachSeqRef.current !== seq) return;
        }
      } catch {
        /* ignore */
      }
      replaying = false;

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

  /* ── 初始化：每次挂载都重新查询后端会话（避免使用过期的缓存列表），
     为空时自动创建第一个终端（StrictMode 并发由 ensureFirstTerminal 去重） ── */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let list: string[];
        try {
          list = await termList();
        } catch {
          list = [];
        }
        if (list.length === 0) {
          const id = await ensureFirstTerminal(createBackend);
          if (id) list = [id];
          if (list.length === 0) {
            // 并发下另一路已创建，重新查询后端
            try {
              list = await termList();
            } catch {
              list = [];
            }
          }
        }
        if (cancelled) return;
        setIds(list);
        setActiveId(list[0] ?? null);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
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
