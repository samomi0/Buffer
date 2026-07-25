import { useMemo, useState } from "react";
import { readWorkbenchSettings, writeWorkbenchSettings } from "../../lib/workbenchSettings";
import { syncHolidaysForYear } from "../../lib/holidaySync";
import { normalizeTopbarToolIds, useAppStore, type ToolManifest } from "../../stores/appStore";
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

  return (
    <div className="settings-shell">
      <div className="settings-container">
        <div className="settings-layout">
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

          <aside className="settings-side-column">
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
          </aside>
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
