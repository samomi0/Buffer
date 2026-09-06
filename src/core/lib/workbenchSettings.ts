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

/** 外观配置（持久化到工作台设置） */
export interface AppearanceSettingsConfig {
  /** 界面主题：light=浅色，dark=深色 */
  theme?: "light" | "dark";
}

export interface WorkbenchSettings {
  topbarToolIds?: string[];
  /** 开发手记标签快速打开使用的命令，默认为 code */
  devlogOpenCmd?: string;
  devlogProgress?: { id: string; name: string; color: string }[];
  /** 开发手记看板列顺序（含无状态占位 key，如 "__no_status__"），undefined = 默认顺序 */
  devlogColumnOrder?: string[];
  /** DeepSeek Harness Web 前端地址配置 */
  dsh?: DshSettingsConfig;
  /** 终端配置 */
  terminal?: TerminalSettingsConfig;
  /** 外观配置（深色模式等） */
  appearance?: AppearanceSettingsConfig;
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