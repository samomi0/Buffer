export interface DevlogTag {
  id: string;
  name: string;
  color: string;
  pinned?: boolean;
  /** 关联的本地目录路径，用于快速在外部编辑器中打开 */
  dir?: string;
}

export interface DevlogLink {
  id: string;
  href: string;
  label: string;
  color: string;
}

/** "include" = 显示含该标签的笔记；"exclude" = 显示不含该标签的笔记 */
export type TagFilterState = "include" | "exclude";

export interface DevlogNote {
  id: string;
  title: string;
  /** TipTap ProseMirror JSON doc */
  content: object;
  /** Tag IDs */
  tags: string[];
  /** 链接列表（从正文中抽离） */
  links?: DevlogLink[];
  /** 图片相对路径列表（从正文中抽离） */
  images?: string[];
  /** ISO datetime string，前10位(YYYY-MM-DD)用于显示 */
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export type TimeFilter =
  | { type: "all" }
  | { type: "today" }
  | { type: "this-week" }
  | { type: "last-week" }
  | { type: "this-month" }
  | { type: "last-month" }
  | { type: "this-quarter" }
  | { type: "this-year" }
  | { type: "custom"; from: string; to: string };

/* ── 时间筛选工具函数 ─────────────────────────────────────────── */
export function getDateRange(filter: TimeFilter, now = new Date()): [Date, Date] | null {
  const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = sod(now);

  switch (filter.type) {
    case "all": return null;
    case "today": return [today, now];
    case "this-week": {
      const dow = today.getDay();
      const start = new Date(today);
      start.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
      return [start, now];
    }
    case "last-week": {
      const dow = today.getDay();
      const thisMonday = new Date(today);
      thisMonday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
      const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7);
      const lastSunday = new Date(thisMonday); lastSunday.setDate(thisMonday.getDate() - 1);
      return [lastMonday, lastSunday];
    }
    case "this-month":
      return [new Date(now.getFullYear(), now.getMonth(), 1), now];
    case "last-month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end   = new Date(now.getFullYear(), now.getMonth(), 0);
      return [start, end];
    }
    case "this-quarter": {
      const q = Math.floor(now.getMonth() / 3);
      return [new Date(now.getFullYear(), q * 3, 1), now];
    }
    case "this-year":
      return [new Date(now.getFullYear(), 0, 1), now];
    case "custom": {
      if (!filter.from || !filter.to) return null;
      return [new Date(filter.from), new Date(filter.to + "T23:59:59")];
    }
  }
}

export function timeFilterLabel(type: TimeFilter["type"]): string {
  const now = new Date();
  const labels: Record<TimeFilter["type"], string> = {
    all: "全部",
    today: "今天",
    "this-week": "本周",
    "last-week": "上周",
    "this-month": `${now.getMonth() + 1}月`,
    "last-month": (() => { const d = new Date(now); d.setMonth(d.getMonth() - 1); return `${d.getMonth() + 1}月`; })(),
    "this-quarter": `${Math.floor(now.getMonth() / 3) + 1}季度`,
    "this-year": `${now.getFullYear()}年`,
    custom: "指定时间段",
  };
  return labels[type];
}

export const TIME_OPTIONS: TimeFilter["type"][] = [
  "all", "today", "this-week", "last-week",
  "this-month", "last-month", "this-quarter", "this-year", "custom",
];
