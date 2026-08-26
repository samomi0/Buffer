import { invoke } from "@tauri-apps/api/core";

/** DeepSeek Harness Web 前端地址配置（持久化到工作台设置） */
export interface DshSettingsConfig {
  webUrl?: string;
}

/** 终端配置（持久化到工作台设置） */
export interface TerminalSettingsConfig {
  shellPath?: string;
  cwd?: string;
}

export interface WorkbenchSettings {
  topbarToolIds?: string[];
  /** 开发手记标签快速打开使用的命令，默认为 code */
  devlogOpenCmd?: string;
  devlogProgress?: { id: string; name: string; color: string }[];
  /** DeepSeek Harness Web 前端地址配置 */
  dsh?: DshSettingsConfig;
  /** 终端配置 */
  terminal?: TerminalSettingsConfig;
}

export async function readWorkbenchSettings(dataDir: string): Promise<WorkbenchSettings> {
  const raw = await invoke<string>("read_workbench_settings", { dataDir });
  try {
    const parsed = JSON.parse(raw) as WorkbenchSettings;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function writeWorkbenchSettings(
  dataDir: string,
  settings: WorkbenchSettings,
): Promise<void> {
  await invoke("write_workbench_settings", {
    dataDir,
    json: JSON.stringify(settings, null, 2),
  });
}