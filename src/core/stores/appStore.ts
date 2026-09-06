import { create } from "zustand";

/** 模块类别：builtin = 标准模块，custom = 定制模块 */
export type ModuleKind = "builtin" | "custom";

export interface DevlogProgress {
  id: string;
  name: string;
  color: string;
}

export const DEFAULT_DEVLOG_PROGRESS: DevlogProgress[] = [
  { id: "plan",   name: "计划",   color: "#6366f1" },
  { id: "todo",   name: "待办",   color: "#f59e0b" },
  { id: "doing",  name: "进行中", color: "#3b82f6" },
  { id: "paused", name: "暂停",   color: "#94a3b8" },
  { id: "done",   name: "完成",   color: "#10b981" },
];

/** DeepSeek Harness Web 集成配置（前端地址） */
export interface DshConfig {
  /** Web 前端地址，默认 http://127.0.0.1:3080 */
  webUrl?: string;
}

export const DEFAULT_DSH_CONFIG: DshConfig = {
  webUrl: "http://127.0.0.1:3080",
};

/** 终端配置 */
export interface TerminalConfig {
  /** 终端可执行文件路径，留空则自动检测 bash.exe */
  shellPath?: string;
  /** 终端启动工作目录，留空则使用用户主目录 */
  cwd?: string;
}

export const DEFAULT_TERMINAL_CONFIG: TerminalConfig = {
  shellPath: "",
  cwd: "",
};

export interface ToolManifest {
  id: string;
  name: string;
  icon: string;
  description: string;
  version: string;
  /** 模块类别，用于区分标准模块与定制模块 */
  kind: ModuleKind;
}

export interface RecentTool {
  id: string;
  openedAt: number;
  pinned: boolean;
}

const RECENT_KEY = "buffer:recent";
const MAX_RECENT = 12;

/** 界面主题 */
export type AppTheme = "light" | "dark";

const THEME_KEY = "buffer:theme";

function loadTheme(): AppTheme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* ignore */
  }
  return "light";
}

function loadRecent(): RecentTool[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveRecent(list: RecentTool[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

export function normalizeTopbarToolIds(ids: string[], tools: ToolManifest[]): string[] {
  const validIds = new Set(tools.map((tool) => tool.id));
  const nextIds: string[] = [];

  for (const id of ids) {
    if (validIds.has(id) && !nextIds.includes(id)) {
      nextIds.push(id);
    }
  }

  return nextIds;
}

interface AppState {
  tools: ToolManifest[];
  searchQuery: string;
  dataDir: string | null;
  activeToolId: string | null;
  recentTools: RecentTool[];
  topbarToolIds: string[];
  /** 从日历热力图传入的日期过滤值 */
  devlogDateFilter: string | null;
  /** 开发手记标签快速打开使用的命令（默认 code，如 idea、subl） */
  devlogOpenCmd: string;
  setDevlogOpenCmd: (cmd: string) => void;
  /** 开发手记进度状态列表 */
  devlogProgress: DevlogProgress[];
  setDevlogProgress: (list: DevlogProgress[]) => void;
  /** 开发手记看板列顺序（含无状态占位 key），null = 使用默认顺序 */
  devlogColumnOrder: string[] | null;
  setDevlogColumnOrder: (order: string[] | null) => void;
  /** DeepSeek Harness Web 前端地址配置 */
  dshConfig: DshConfig;
  setDshConfig: (config: DshConfig) => void;
  /** 终端配置 */
  terminalConfig: TerminalConfig;
  setTerminalConfig: (config: TerminalConfig) => void;
  /** 界面主题（浅色/深色） */
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;

  setTools: (tools: ToolManifest[]) => void;
  setDataDir: (dir: string) => void;
  setSearchQuery: (q: string) => void;
  pushTool: (id: string) => void;
  popTool: () => void;
  togglePin: (id: string) => void;
  setTopbarToolIds: (ids: string[]) => void;
  setDevlogDateFilter: (date: string | null) => void;

  // legacy aliases used by existing tool components
  openTool: (id: string) => void;
  closeTool: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  tools: [],
  searchQuery: "",
  dataDir: null,
  activeToolId: null,
  recentTools: loadRecent(),
  topbarToolIds: [],
  devlogDateFilter: null,
  devlogOpenCmd: "code",
  devlogProgress: DEFAULT_DEVLOG_PROGRESS,
  devlogColumnOrder: null,
  dshConfig: DEFAULT_DSH_CONFIG,
  terminalConfig: DEFAULT_TERMINAL_CONFIG,
  theme: loadTheme(),

  setTools: (tools) => set((state) => ({
    tools,
    topbarToolIds: normalizeTopbarToolIds(state.topbarToolIds, tools),
  })),
  setDataDir: (dir) => set({ dataDir: dir }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  pushTool: (id) => {
    const current = get();
    const existing = current.recentTools.find((r) => r.id === id);
    const entry: RecentTool = {
      id,
      openedAt: Date.now(),
      pinned: existing?.pinned ?? false,
    };
    const without = current.recentTools.filter((r) => r.id !== id);
    const pinned = [entry, ...without].filter((r) => r.pinned);
    const nonPinned = [entry, ...without]
      .filter((r) => !r.pinned)
      .slice(0, MAX_RECENT);
    const newRecent = [...pinned, ...nonPinned];
    saveRecent(newRecent);
    set({ activeToolId: id, searchQuery: "", recentTools: newRecent });
  },

  popTool: () => set({ activeToolId: null }),

  togglePin: (id) => {
    const newRecent = get().recentTools.map((r) =>
      r.id === id ? { ...r, pinned: !r.pinned } : r
    );
    saveRecent(newRecent);
    set({ recentTools: newRecent });
  },

  setTopbarToolIds: (ids) => set({ topbarToolIds: normalizeTopbarToolIds(ids, get().tools) }),

  setDevlogDateFilter: (date) => set({ devlogDateFilter: date }),
  setDevlogOpenCmd: (cmd) => set({ devlogOpenCmd: cmd }),
  setDevlogProgress: (list) => set({ devlogProgress: list }),
  setDevlogColumnOrder: (order) => set({ devlogColumnOrder: order }),
  setDshConfig: (config) => set({ dshConfig: config }),
  setTerminalConfig: (config) => set({ terminalConfig: config }),
  setTheme: (theme) => set({ theme }),

  openTool: (id) => get().pushTool(id),
  closeTool: () => get().popTool(),
}));
