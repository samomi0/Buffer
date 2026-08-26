export type EntryType = "server" | "password" | "custom";

export interface CustomField {
  key: string;
  value: string;
  secret: boolean;
  /** Whether this field is considered "key" (shown on card) */
  keyField?: boolean;
}

export interface VaultEntry {
  id: string;
  type: EntryType;
  name: string;
  tags: string[];
  note: string;
  /** 使用（复制）频次 */
  usageCount?: number;
  /** 最近一次使用（复制）时间 (ISO) */
  lastUsedAt?: string;
  // server
  ip?: string;
  dir?: string;
  osType?: string;
  // password
  url?: string;
  account?: string;
  password?: string;
  // custom
  fields?: CustomField[];
}

export interface VaultData {
  entries: VaultEntry[];
  tags: string[];
}

export const EMPTY_VAULT: VaultData = { entries: [], tags: [] };
