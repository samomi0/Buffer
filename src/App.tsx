import { useEffect, useState } from "react";
import { useAppStore, type ToolManifest, type AppTheme, DEFAULT_DSH_CONFIG, DEFAULT_TERMINAL_CONFIG } from "./core/stores/appStore";
import { AppTopBar } from "./core/components/dashboard/AppTopBar";
import { WindowBar } from "./core/components/chrome/WindowBar";
import { DashboardPage } from "./core/components/dashboard/DashboardPage";
import { ToolFrame } from "./core/components/tools/ToolFrame";
import { DataDirSetup } from "./core/components/setup/DataDirSetup";
import { SettingsPage } from "./core/components/settings/SettingsPage";
import { CUSTOM_MODULES, CUSTOM_COMPONENTS } from "./custom/index";
import { VaultPage } from "./modules/vault/VaultPage";
import { DevlogPage } from "./modules/devlog/DevlogPage";
import { DshWebPage } from "./modules/dshweb/DshWebPage";
import { TerminalPage } from "./modules/terminal/TerminalPage";
import { readWorkbenchSettings, writeWorkbenchSettings } from "./core/lib/workbenchSettings";
import { normalizeTopbarToolIds } from "./core/stores/appStore";

type AppPhase = "loading" | "setup" | "ready";

/**
 * ── 标准模块 ─────────────────────────────────────────────
 * 随平台发行的内置功能，代码位于 src/modules/。
 * 可直接复用平台核心 API（core/stores、core/lib、Tauri commands）。
 */
const BUILTIN_MODULES: ToolManifest[] = [
  {
    id: "SecureVault",
    name: "密库",
    icon: "lock",
    description: "加密存储服务器与密码等隐私信息",
    version: "1.0",
    kind: "builtin",
  },
  {
    id: "DevLog",
    name: "开发手记",
    icon: "book",
    description: "记录开发任务细节与笔记",
    version: "1.0",
    kind: "builtin",
  },
  {
    id: "DshWeb",
    name: "Harness Web",
    icon: "dshweb",
    description: "内嵌访问 DeepSeek Harness Web 前端地址",
    version: "1.0",
    kind: "builtin",
  },
  {
    id: "Terminal",
    name: "终端",
    icon: "terminal",
    description: "创建终端会话并运行指令（默认 bash.exe）",
    version: "1.0",
    kind: "builtin",
  },
];

const BUILTIN_TOOLS = [...BUILTIN_MODULES, ...CUSTOM_MODULES];

function App() {
  const [phase, setPhase] = useState<AppPhase>("loading");
  const tools = useAppStore((s) => s.tools);
  const activeToolId = useAppStore((s) => s.activeToolId);
  const dataDir = useAppStore((s) => s.dataDir);
  const setTools = useAppStore((s) => s.setTools);
  const setDataDir = useAppStore((s) => s.setDataDir);
  const setTopbarToolIds = useAppStore((s) => s.setTopbarToolIds);
  const setDevlogOpenCmd = useAppStore((s) => s.setDevlogOpenCmd);
  const setDevlogProgress = useAppStore((s) => s.setDevlogProgress);
  const setDevlogColumnOrder = useAppStore((s) => s.setDevlogColumnOrder);
  const setDshConfig = useAppStore((s) => s.setDshConfig);
  const setTerminalConfig = useAppStore((s) => s.setTerminalConfig);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  /* ── 应用并缓存主题（深色模式） ─────────────────────────── */
  useEffect(() => {
    const applyTheme = (t: AppTheme) => {
      document.documentElement.dataset.theme = t;
      try {
        localStorage.setItem("buffer:theme", t);
      } catch {
        /* ignore */
      }
    };
    applyTheme(theme);
  }, [theme]);


  const getDefaultTopbarToolIds = (items: ToolManifest[]) => items.map((tool) => tool.id);

  useEffect(() => {
    async function init() {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const saved: string | null = await invoke("check_saved_data_dir");
        if (saved) {
          setDataDir(saved);
          setPhase("ready");
        } else {
          setPhase("setup");
        }
      } catch {
        setPhase("setup");
      }
    }
    init();
    setTools(BUILTIN_TOOLS);
  }, [setTools, setDataDir]);

  useEffect(() => {
    if (!dataDir || tools.length === 0) {
      return;
    }

    const currentDataDir = dataDir;
    let cancelled = false;

    async function loadWorkbench() {
      try {
        const settings = await readWorkbenchSettings(currentDataDir);
        const normalizedIds = normalizeTopbarToolIds(
          settings.topbarToolIds ?? getDefaultTopbarToolIds(tools),
          tools,
        );

        if (!cancelled) {
          setTopbarToolIds(normalizedIds);
          if (settings.devlogOpenCmd) {
            setDevlogOpenCmd(settings.devlogOpenCmd);
          }
          if (settings.devlogProgress && settings.devlogProgress.length > 0) {
            setDevlogProgress(settings.devlogProgress);
          }
          if (Array.isArray(settings.devlogColumnOrder)) {
            setDevlogColumnOrder(settings.devlogColumnOrder);
          }
          if (settings.dsh) {
            setDshConfig({ ...DEFAULT_DSH_CONFIG, ...settings.dsh });
          }
          if (settings.terminal) {
            setTerminalConfig({ ...DEFAULT_TERMINAL_CONFIG, ...settings.terminal });
          }
          if (settings.appearance?.theme === "dark" || settings.appearance?.theme === "light") {
            setTheme(settings.appearance.theme);
          }
        }

        if (JSON.stringify(settings.topbarToolIds ?? []) !== JSON.stringify(normalizedIds)) {
          await writeWorkbenchSettings(currentDataDir, {
            ...settings,
            topbarToolIds: normalizedIds,
          });
        }
      } catch {
        if (!cancelled) {
          setTopbarToolIds(getDefaultTopbarToolIds(tools));
        }
      }
    }

    loadWorkbench();

    return () => {
      cancelled = true;
    };
  }, [dataDir, setTopbarToolIds, tools]);

  if (phase === "loading") {
    return (
      <div className="app-window">
        <WindowBar />
        <div className="phase-frame">
          <div className="loading-shell">
            <span className="loading-pulse">启动中...</span>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "setup") {
    return (
      <div className="app-window">
        <WindowBar />
        <div className="phase-frame">
          <DataDirSetup
            onComplete={(dir) => {
              setDataDir(dir);
              setPhase("ready");
            }}
          />
        </div>
      </div>
    );
  }

  /**
   * 根据模块分类渲染：
   *   builtin → 标准模块（src/modules/）
   *   custom  → 查 CUSTOM_COMPONENTS 映射，无则走 iframe（public/custom-tools/）
   *   Settings → 平台内置
   */
  function renderModule(toolId: string): React.ReactNode {
    const tool = tools.find((t) => t.id === toolId);
    if (!tool) return <DashboardPage />;

    if (tool.kind === "builtin") {
      switch (tool.id) {
        case "SecureVault": return <VaultPage />;
        case "DevLog":      return <DevlogPage />;
        case "DshWeb":      return <DshWebPage />;
        case "Terminal":    return <TerminalPage />;
        default:            return <DashboardPage />;
      }
    }

    // custom —— 有原生 React 实现的优先，无则走 iframe
    const CustomComponent = CUSTOM_COMPONENTS[tool.id];
    if (CustomComponent) return <CustomComponent />;
    return <ToolFrame tool={tool} />;
  }

  let page: React.ReactNode;
  if (activeToolId === "Settings") {
    page = (
      <SettingsPage
        dataDir={dataDir}
        onDataDirChange={(dir) => setDataDir(dir)}
      />
    );
  } else if (activeToolId) {
    page = renderModule(activeToolId);
  } else {
    page = <DashboardPage />;
  }

  return (
    <div className="app-shell">
      <AppTopBar />
      <main className="app-page">{page}</main>
    </div>
  );
}

export default App;
