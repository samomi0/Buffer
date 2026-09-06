import { useMemo, useState } from "react";
import type { DevlogNote, DevlogTag } from "./devlog.types";
import type { DevlogProgress } from "../../core/stores/appStore";
import { tipTapToPlainText } from "../../core/lib/richTextMigration";

type WeeklyReportMode = "rich" | "markdown";

type WeeklyReportItem = {
  id: string;
  title: string;
  content: object;
  tags: string[];
  progressAt: string;
  progressName: string;
  progressColor: string;
};

type WeeklyReportGroup = {
  id: string;
  name: string;
  color: string;
  items: WeeklyReportItem[];
};

type WeeklyReportData = {
  total: number;
  groups: WeeklyReportGroup[];
};

interface WeeklyReportProps {
  /** 全量笔记（含归档、不做标签筛选），用于统计本周进度记录 */
  notes: DevlogNote[];
  tags: DevlogTag[];
  progressList: DevlogProgress[];
}

/**
 * 本周工作周报：触发按钮（放入工具栏） + 富文本/Markdown 灯箱。
 * 样式沿用 CalendarModule.css 中全局加载的 .weekly-report-* 规则。
 */
export function WeeklyReport({ notes, tags, progressList }: WeeklyReportProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<WeeklyReportMode>("rich");
  const [copied, setCopied] = useState(false);

  // 每次打开时刷新“本周”范围，避免跨周后范围过期
  const [range, setRange] = useState<[Date, Date]>(() => getWeekRange(new Date()));
  const [weekStart, weekEnd] = range;

  const tagMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const tag of tags) map[tag.id] = tag.name;
    return map;
  }, [tags]);

  const data = useMemo(
    () => buildWeeklyReportData(notes, tagMap, progressList, weekStart, weekEnd),
    [notes, tagMap, progressList, weekStart, weekEnd],
  );

  const markdown = useMemo(
    () => buildWeeklyReportMarkdown(data, tagMap, weekStart, weekEnd),
    [data, tagMap, weekStart, weekEnd],
  );

  function openReport() {
    setRange(getWeekRange(new Date()));
    setOpen(true);
  }

  function handleCopy() {
    const text =
      mode === "markdown"
        ? markdown
        : buildWeeklyReportRichCopyText(data, tagMap, weekStart, weekEnd);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      <button className="devlog-weekly-btn" onClick={openReport} title="查看本周周报">
        <WeeklyReportIcon />
        <span>周报</span>
      </button>

      {open && (
        <div className="weekly-report-backdrop" onClick={() => setOpen(false)}>
          <div className="weekly-report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="weekly-report-header">
              <div className="weekly-report-title-block">
                <h2>本周工作周报</h2>
                <span className="weekly-report-range">
                  {formatFullDate(weekStart)} ~ {formatFullDate(weekEnd)}
                </span>
              </div>
              <div className="weekly-report-actions">
                <div className="weekly-report-mode-switch" role="tablist" aria-label="周报样式切换">
                  <button
                    className={`weekly-report-mode-btn ${mode === "rich" ? "active" : ""}`}
                    onClick={() => setMode("rich")}
                  >
                    富文本
                  </button>
                  <button
                    className={`weekly-report-mode-btn ${mode === "markdown" ? "active" : ""}`}
                    onClick={() => setMode("markdown")}
                  >
                    Markdown
                  </button>
                </div>
                <button
                  className={`weekly-report-copy-btn ${copied ? "copied" : ""}`}
                  onClick={handleCopy}
                >
                  {copied ? "✓ 已复制" : "复制"}
                </button>
                <button className="weekly-report-close-btn" onClick={() => setOpen(false)}>
                  <CloseIcon />
                </button>
              </div>
            </div>

            <div className="weekly-report-body">
              {mode === "markdown" ? (
                <pre className="weekly-report-markdown">{markdown}</pre>
              ) : (
                <div className="weekly-report-rich">
                  <div className="weekly-report-rich-summary">
                    <span>本周共统计 {data.total} 条进度记录</span>
                  </div>
                  {data.groups.length === 0 ? (
                    <div className="weekly-report-rich-empty">本周暂无进度切换记录</div>
                  ) : (
                    data.groups.map((group) => (
                      <section key={group.id} className="weekly-report-group">
                        <div className="weekly-report-group-head">
                          <span className="weekly-report-group-dot" style={{ background: group.color }} />
                          <h3>{group.name}</h3>
                          <span className="weekly-report-group-count">{group.items.length} 条</span>
                        </div>
                        <div className="weekly-report-group-list">
                          {group.items.map((item) => {
                            const tagNames = item.tags.map((id) => tagMap[id]).filter(Boolean);
                            const text = tipTapToPlainText(item.content).trim();
                            return (
                              <article key={item.id} className="weekly-report-note-card">
                                <div className="weekly-report-note-meta">
                                  <span className="weekly-report-note-time">{formatReportTime(item.progressAt)}</span>
                                  {tagNames.length > 0 && (
                                    <div className="weekly-report-note-tags">
                                      {tagNames.map((tag) => (
                                        <span key={`${item.id}-${tag}`} className="weekly-report-note-tag">{tag}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <h4>{item.title}</h4>
                                {text && <p>{text}</p>}
                              </article>
                            );
                          })}
                        </div>
                      </section>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── 图标 ─────────────────────────────────────────────────────── */

function WeeklyReportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4M16 2v4" />
      <path d="M8 12h5M8 16h8" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

/* ── 周报工具函数 ──────────────────────────────────────────────── */

function getWeekRange(date: Date): [Date, Date] {
  const dow = date.getDay(); // 0 = 周日
  const mondayOffset = dow === 0 ? 6 : dow - 1;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - mondayOffset);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return [monday, sunday];
}

function buildWeeklyReportData(
  notes: DevlogNote[],
  tagMap: Record<string, string>,
  progressList: DevlogProgress[],
  weekStart: Date,
  weekEnd: Date,
): WeeklyReportData {
  const progressLookup = new Map(progressList.map((item) => [item.id, item]));
  const weekNotes = notes
    .filter((n) => {
      if (!n.progressAt) return false;
      const d = parseDateKey(n.progressAt.slice(0, 10));
      if (Number.isNaN(d.getTime())) return false;
      return d >= weekStart && d <= weekEnd;
    })
    .sort((a, b) => (a.progressAt ?? "").localeCompare(b.progressAt ?? ""));

  const groups = new Map<string, WeeklyReportGroup>();

  for (const note of weekNotes) {
    const progress = note.progressId ? progressLookup.get(note.progressId) : null;
    const groupId = progress?.id ?? "none";
    const groupName = progress?.name ?? "未设置进度";
    const groupColor = progress?.color ?? "#94a3b8";
    if (!groups.has(groupId)) {
      groups.set(groupId, { id: groupId, name: groupName, color: groupColor, items: [] });
    }
    groups.get(groupId)!.items.push({
      id: note.id,
      title: note.title,
      content: note.content,
      tags: note.tags,
      progressAt: note.progressAt!,
      progressName: groupName,
      progressColor: groupColor,
    });
  }

  const orderedGroups = Array.from(groups.values()).sort((left, right) => {
    const leftIndex = progressList.findIndex((item) => item.id === left.id);
    const rightIndex = progressList.findIndex((item) => item.id === right.id);
    if (leftIndex === -1 && rightIndex === -1) return left.name.localeCompare(right.name, "zh-CN");
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });

  return {
    total: weekNotes.length,
    groups: orderedGroups,
  };
}

function buildWeeklyReportMarkdown(
  data: WeeklyReportData,
  tagMap: Record<string, string>,
  weekStart: Date,
  weekEnd: Date,
): string {
  if (data.total === 0) {
    return `# 本周工作周报\n\n${formatFullDate(weekStart)} ~ ${formatFullDate(weekEnd)}\n\n_本周暂无进度切换记录_`;
  }

  let body = `# 本周工作周报\n\n${formatFullDate(weekStart)} ~ ${formatFullDate(weekEnd)}\n> 共统计 **${data.total}** 条进度记录\n`;

  for (const group of data.groups) {
    body += `\n## ${group.name}\n\n`;
    for (const item of group.items) {
      body += `- ${formatReportTime(item.progressAt)} **${item.title}**`;
      const text = tipTapToPlainText(item.content).trim();
      if (text) {
        body += `\n  - ${text.replace(/\n+/g, " ")}`;
      }
      const tagNames = item.tags.map((id) => tagMap[id]).filter(Boolean);
      if (tagNames.length > 0) {
        body += `\n  - 标签：${tagNames.join("、")}`;
      }
      body += "\n";
    }
  }

  return body.trimEnd();
}

function buildWeeklyReportRichCopyText(
  data: WeeklyReportData,
  tagMap: Record<string, string>,
  weekStart: Date,
  weekEnd: Date,
): string {
  if (data.total === 0) {
    return `本周工作周报\n${formatFullDate(weekStart)} ~ ${formatFullDate(weekEnd)}\n\n本周暂无进度切换记录`;
  }

  let text = `本周工作周报\n${formatFullDate(weekStart)} ~ ${formatFullDate(weekEnd)}\n共统计 ${data.total} 条进度记录\n`;
  for (const group of data.groups) {
    text += `\n【${group.name}】\n`;
    for (const item of group.items) {
      // 富文本复制：只保留标题 + 标签，不复制正文内容
      text += `${formatReportTime(item.progressAt)} ${item.title}`;
      const tagNames = item.tags.map((id) => tagMap[id]).filter(Boolean);
      if (tagNames.length > 0) {
        text += ` ｜ 标签：${tagNames.join("、")}`;
      }
      text += "\n";
    }
  }
  return text.trimEnd();
}

function parseDateKey(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function formatFullDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}年${m}月${d}日`;
}

function formatReportTime(value: string): string {
  const dateOnly = value.slice(0, 10);
  const date = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}
