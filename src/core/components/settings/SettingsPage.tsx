import { useMemo, useState, useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { readWorkbenchSettings, writeWorkbenchSettings } from "../../lib/workbenchSettings";
import { syncHolidaysForYear } from "../../lib/holidaySync";
import { normalizeTopbarToolIds, useAppStore, type ToolManifest, type DevlogProgress, DEFAULT_DEVLOG_PROGRESS } from "../../stores/appStore";
import "./SettingsPage.css";

interface Props {
  dataDir: string | null;
  onDataDirChange: (dir: string) => void;
}

export function SettingsPage({ dataDir, onDataDirChange }: Props) {
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [holidayRefreshing, setHolidayRefreshing] = useState(false);
  const [holidayMsg, setHolidayMsg] = useState<string | null>(null);
  const [holidayYear, setHolidayYear] = useState(String(new Date().getFullYear()));
  const [topbarSaving, setTopbarSaving] = useState(false);

  const devlogOpenCmd = useAppStore((s) => s.devlogOpenCmd);
  const setDevlogOpenCmd = useAppStore((s) => s.setDevlogOpenCmd);
  const [openCmdDraft, setOpenCmdDraft] = useState(devlogOpenCmd);
  const [openCmdSaved, setOpenCmdSaved] = useState(false);

  const devlogProgress = useAppStore((s) => s.devlogProgress);
  const setDevlogProgress = useAppStore((s) => s.setDevlogProgress);
  const [progressDraft, setProgressDraft] = useState<DevlogProgress[]>(devlogProgress);

  const tools = useAppStore((s) => s.tools);
  const topbarToolIds = useAppStore((s) => s.topbarToolIds);
  const setTopbarToolIds = useAppStore((s) => s.setTopbarToolIds);

  const orderedTools = useMemo(() => {
    const visibleTools = topbarToolIds
      .map((id) => tools.find((tool) => tool.id === id))
      .filter((tool): tool is ToolManifest => Boolean(tool));
    const hiddenTools = tools.filter((tool) => !topbarToolIds.includes(tool.id));
    return [...visibleTools, ...hiddenTools];
  }, [tools, topbarToolIds]);

  const persistTopbarToolIds = async (nextIds: string[]) => {
    if (!dataDir) return;

    const previousIds = topbarToolIds;
    const normalizedIds = normalizeTopbarToolIds(nextIds, tools);
    setTopbarToolIds(normalizedIds);
    setTopbarSaving(true);

    try {
      const settings = await readWorkbenchSettings(dataDir);
      await writeWorkbenchSettings(dataDir, {
        ...settings,
        topbarToolIds: normalizedIds,
      });
    } catch (e) {
      setTopbarToolIds(previousIds);
    } finally {
      setTopbarSaving(false);
    }
  };

  const handleToggleTool = async (toolId: string) => {
    if (topbarToolIds.includes(toolId)) {
      await persistTopbarToolIds(topbarToolIds.filter((id) => id !== toolId));
      return;
    }

    await persistTopbarToolIds([...topbarToolIds, toolId]);
  };

  const handleChangeDir = async () => {
    setSelecting(true);
    setError(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const dir: string | null = await invoke("select_data_dir");
      if (dir) onDataDirChange(dir);
      else setError("未选择目录");
    } catch (e) {
      setError(String(e));
    } finally {
      setSelecting(false);
    }
  };

  const handleSaveOpenCmd = async () => {
    const cmd = openCmdDraft.trim() || "code";
    setDevlogOpenCmd(cmd);
    if (dataDir) {
      try {
        const settings = await readWorkbenchSettings(dataDir);
        await writeWorkbenchSettings(dataDir, { ...settings, devlogOpenCmd: cmd });
        setOpenCmdSaved(true);
        setTimeout(() => setOpenCmdSaved(false), 2000);
      } catch { /* ignore */ }
    }
  };

  const handleRefreshHolidays = async () => {
    if (!dataDir) {
      setHolidayMsg("请先设置数据目录");
      return;
    }
    const year = parseInt(holidayYear, 10);
    if (!year || year < 2010 || year > 2030) {
      setHolidayMsg("请输入有效年份（2010-2030）");
      return;
    }
    setHolidayRefreshing(true);
    setHolidayMsg(null);
    try {
      const result = await syncHolidaysForYear(dataDir, year, true);
      setHolidayMsg(result ? result.message : `${year} 年节假日已是最新`);
    } catch (e) {
      setHolidayMsg(`刷新失败: ${String(e)}`);
    } finally {
      setHolidayRefreshing(false);
    }
  };

  const saveProgress = useCallback(async (next: DevlogProgress[]) => {
    setDevlogProgress(next);
    if (!dataDir) return;
    try {
      const settings = await readWorkbenchSettings(dataDir);
      await writeWorkbenchSettings(dataDir, { ...settings, devlogProgress: next });
    } catch { /* ignore */ }
  }, [dataDir, setDevlogProgress]);

  function handleProgressNameChange(idx: number, name: string) {
    const next = progressDraft.map((p, i) => i === idx ? { ...p, name } : p);
    setProgressDraft(next);
    saveProgress(next);
  }

  function handleProgressColorChange(idx: number, color: string) {
    const next = progressDraft.map((p, i) => i === idx ? { ...p, color } : p);
    setProgressDraft(next);
    saveProgress(next);
  }

  function handleProgressDelete(idx: number) {
    const next = progressDraft.filter((_, i) => i !== idx);
    setProgressDraft(next);
    saveProgress(next);
  }

  function handleProgressAdd() {
    const colors = ["#6366f1", "#f59e0b", "#3b82f6", "#94a3b8", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4"];
    const usedColors = new Set(progressDraft.map((p) => p.color));
    const color = colors.find((c) => !usedColors.has(c)) ?? "#6366f1";
    const next = [...progressDraft, { id: crypto.randomUUID(), name: "新状态", color }];
    setProgressDraft(next);
    saveProgress(next);
  }

  function handleProgressReset() {
    setProgressDraft(DEFAULT_DEVLOG_PROGRESS);
    saveProgress(DEFAULT_DEVLOG_PROGRESS);
  }

  // ── Masonry 布局：块按自然高度自由分布，互不强制定位对齐 ──
  const [isWide, setIsWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1081px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1081px)");
    const onChange = (e: MediaQueryListEvent) => setIsWide(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const measureRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [panelHeights, setPanelHeights] = useState<number[]>([]);

  useLayoutEffect(() => {
    const els = measureRefs.current.filter(Boolean) as HTMLDivElement[];
    if (els.length === 0) return;
    const update = () => {
      setPanelHeights(measureRefs.current.map((el) => el?.offsetHeight ?? 0));
    };
    update();
    const obs = new ResizeObserver(update);
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const panels: { key: string; node: ReactNode }[] = [
    {
      key: "tools",
      node: (
        <section className="settings-panel settings-panel-primary settings-tools-panel">
          <div className="settings-panel-head">
            <div>
              <h2>右上角快捷按钮</h2>
              <p>右侧开关控制是否显示在顶部栏。</p>
            </div>
          </div>

          <div className="settings-tool-list">
            {orderedTools.map((tool) => {
              const visibleIndex = topbarToolIds.indexOf(tool.id);
              const checked = visibleIndex !== -1;

              return (
                <div
                  key={tool.id}
                  className={`settings-tool-row ${checked ? "is-visible" : "is-hidden"}`}
                >
                  <div className="settings-tool-main">
                    <strong>{tool.name}</strong>
                    <p>{tool.description}</p>
                  </div>

                  <button
                    type="button"
                    className={`settings-toggle ${checked ? "on" : ""}`}
                    onClick={() => void handleToggleTool(tool.id)}
                    disabled={topbarSaving}
                    role="switch"
                    aria-checked={checked}
                    title={checked ? "从顶栏隐藏" : "显示到顶栏"}
                  >
                    <span className="settings-toggle-knob" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ),
    },
    {
      key: "dataDir",
      node: (
        <section className="settings-panel">
          <div className="settings-panel-head compact">
            <div>
              <h2>数据目录</h2>
              <p>模板、日历与顶栏配置统一写入这里。</p>
            </div>
          </div>

          <div className="settings-field-card">
            <span className="settings-field-label">当前路径</span>
            <div className="settings-field-row">
              <span className="settings-dir-path">{dataDir || "未设置"}</span>
              <button className="settings-btn" onClick={handleChangeDir} disabled={selecting}>
                <FolderIcon />
                {selecting ? "选择中..." : "更改"}
              </button>
            </div>
            {error && <p className="settings-inline-message is-error">{error}</p>}
          </div>
        </section>
      ),
    },
    {
      key: "holiday",
      node: (
        <section className="settings-panel">
          <div className="settings-panel-head compact">
            <div>
              <h2>节假日刷新</h2>
              <p>按年份强制更新法定节假日与调休数据。</p>
            </div>
          </div>

          <div className="settings-field-card">
            <span className="settings-field-label">同步年份</span>
            <div className="settings-field-row">
              <input
                className="settings-year-input"
                type="number"
                min={2010}
                max={2030}
                value={holidayYear}
                onChange={(e) => setHolidayYear(e.target.value)}
              />
              <button
                className="settings-btn"
                onClick={handleRefreshHolidays}
                disabled={holidayRefreshing || !dataDir}
              >
                {holidayRefreshing ? "刷新中..." : "强制刷新"}
              </button>
            </div>
            {holidayMsg && (
              <p className={`settings-inline-message ${holidayMsg.startsWith("刷新失败") ? "is-error" : ""}`}>
                {holidayMsg}
              </p>
            )}
          </div>
        </section>
      ),
    },
    {
      key: "editor",
      node: (
        <section className="settings-panel">
          <div className="settings-panel-head compact">
            <div>
              <h2>外部编辑器</h2>
              <p>开发手记标签的快速打开按钮使用的命令。</p>
            </div>
          </div>

          <div className="settings-field-card">
            <span className="settings-field-label">打开命令</span>
            <div className="settings-field-row">
              <input
                className="settings-open-cmd-input"
                type="text"
                value={openCmdDraft}
                onChange={(e) => setOpenCmdDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleSaveOpenCmd()}
                placeholder="code"
              />
              <button className="settings-btn" onClick={() => void handleSaveOpenCmd()}>
                {openCmdSaved ? "已保存" : "保存"}
              </button>
            </div>
            <p className="settings-inline-message">
              常用值：<code>code</code>（VSCode）、<code>idea</code>（IntelliJ）、<code>subl</code>（Sublime）
            </p>
          </div>
        </section>
      ),
    },
    {
      key: "progress",
      node: (
        <section className="settings-panel">
          <div className="settings-panel-head compact">
            <div>
              <h2>开发手记进度</h2>
              <p>自定义笔记的进度状态与颜色，在笔记详情中设置。</p>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="settings-btn settings-btn-sm" onClick={handleProgressAdd}>+ 添加</button>
              <button className="settings-btn settings-btn-sm settings-btn-ghost" onClick={handleProgressReset} title="恢复默认">重置</button>
            </div>
          </div>

          <div className="settings-progress-list">
            {progressDraft.map((p, idx) => (
              <div key={p.id} className="settings-progress-row">
                <input
                  type="color"
                  className="settings-progress-color"
                  value={p.color}
                  onChange={(e) => handleProgressColorChange(idx, e.target.value)}
                  title="点击更改颜色"
                />
                <input
                  type="text"
                  className="settings-progress-name"
                  value={p.name}
                  onChange={(e) => handleProgressNameChange(idx, e.target.value)}
                  maxLength={12}
                />
                <span
                  className="settings-progress-preview"
                  style={{ background: `${p.color}18`, color: p.color, borderColor: `${p.color}45` }}
                >
                  {p.name}
                </span>
                <button
                  className="settings-progress-delete"
                  onClick={() => handleProgressDelete(idx)}
                  title="删除"
                  disabled={progressDraft.length <= 1}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>
      ),
    },
  ];

  const allocation = useMemo(() => {
    if (panelHeights.length !== panels.length) return null;
    const cols: number[][] = [[], []];
    const colHeights = [0, 0];
    panelHeights.forEach((h, i) => {
      const c = colHeights[0] <= colHeights[1] ? 0 : 1;
      cols[c].push(i);
      colHeights[c] += h;
    });
    return cols;
  }, [panelHeights]);

  return (
    <div className="settings-shell">
      <div className="settings-container">
        {isWide && allocation ? (
          <div className="settings-layout">
            {allocation.map((col, c) => (
              <div className="settings-column" key={c}>
                {col.map((i) => (
                  <div className="settings-panel-wrap" key={panels[i].key}>
                    {panels[i].node}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="settings-layout">
            {panels.map((p) => (
              <div className="settings-panel-wrap" key={p.key}>
                {p.node}
              </div>
            ))}
          </div>
        )}

        <div className="settings-measure" aria-hidden="true">
          {panels.map((p, i) => (
            <div
              className="settings-panel-wrap"
              key={p.key}
              ref={(el) => { measureRefs.current[i] = el; }}
            >
              {p.node}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}



function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}
