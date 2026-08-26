import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../stores/appStore";
import { syncHolidaysForYear } from "../../lib/holidaySync";
import { RichTextEditor } from "../../components/RichTextEditor";
import { plainTextToTipTapJSON, tipTapToPlainText, isTipTapDoc } from "../../lib/richTextMigration";
import "./CalendarModule.css";

type EventColor = "red" | "blue" | "green" | "orange" | "purple" | "teal" | "pink" | "cyan" | "holiday" | "workday";

type CalendarEvent = {
  id: string;
  title: string;
  startDate: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  color?: EventColor;
  /** TipTap ProseMirror JSON doc — migrated from plain string on load */
  notes?: object | string;
};

type EventDraft = {
  id?: string;
  title: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  color: EventColor;
  notes: object;
};

type EditorState = {
  open: boolean;
  draft: EventDraft;
};

type CalendarDay = {
  key: string;
  date: Date | null;
  events: CalendarEvent[];
};

type MonthSection = {
  monthKey: string;
  monthDate: Date;
  days: CalendarDay[];
};

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

const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const MINI_WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
const MONTH_NAMES = [
  "一月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "十一月", "十二月",
];
const EVENT_COLORS: EventColor[] = ["blue", "green", "orange", "red", "purple", "teal", "pink", "cyan"];
const MONTH_WINDOW_BEFORE = 3;
const MONTH_WINDOW_AFTER = 5;
const MAX_CELL_EVENTS = 3;

export function CalendarModule() {
  const dataDir = useAppStore((s) => s.dataDir);
  const pushTool = useAppStore((s) => s.pushTool);
  const setDevlogDateFilter = useAppStore((s) => s.setDevlogDateFilter);
  const devlogProgress = useAppStore((s) => s.devlogProgress);

  // today 每分钟刷新一次，保证跨夜后日期与倒计时正确
  const [today, setToday] = useState(() => startOfDay(new Date()));
  useEffect(() => {
    setToday(startOfDay(new Date()));
    const timer = setInterval(() => setToday(startOfDay(new Date())), 60_000);
    return () => clearInterval(timer);
  }, []);

  const todayKey = formatDateKey(today);
  const initialMonth = useMemo(() => startOfMonth(today), [today]);

  const [focusMonth, setFocusMonth] = useState(initialMonth);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [devlogCounts, setDevlogCounts] = useState<Record<string, number>>({});
  const [devlogNotes, setDevlogNotes] = useState<{
    id: string; title: string; content: object;
    tags: string[]; createdAt: string; archived?: boolean;
    progressId?: string; progressAt?: string;
  }[]>([]);
  const [devlogTagMap, setDevlogTagMap] = useState<Record<string, string>>({});
  const [weeklyReportOpen, setWeeklyReportOpen] = useState(false);
  const [weeklyReportMode, setWeeklyReportMode] = useState<WeeklyReportMode>("rich");
  const [reportCopied, setReportCopied] = useState(false);
  const [months, setMonths] = useState(() =>
    createMonthWindow(initialMonth, MONTH_WINDOW_BEFORE, MONTH_WINDOW_AFTER)
  );
  const [editor, setEditor] = useState<EditorState>({
    open: false,
    draft: createDraft(todayKey),
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const monthRefs = useRef<Record<string, HTMLElement | null>>({});
  const didInitialScrollRef = useRef(false);
  const pendingPrependRef = useRef<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!dataDir) {
        setEvents([]);
        return;
      }
      try {
        const raw = await invoke<string>("read_calendar_events", { dataDir });
        const parsed = JSON.parse(raw) as CalendarEvent[];
        setEvents(Array.isArray(parsed) ? normalizeEvents(parsed) : []);
      } catch {
        setEvents([]);
      }
    }
    load();
  }, [dataDir]);

  // 自动同步当年节假日：每年 1 月 1 日后，若当年假日事件尚未创建则从 APIsBO 拉取
  const holidaySyncTriedRef = useRef(false);
  useEffect(() => {
    if (!dataDir || holidaySyncTriedRef.current) return;
    const now = new Date();
    const currentYear = now.getFullYear();
    if (now < new Date(currentYear, 0, 1)) return;

    async function doSync() {
      holidaySyncTriedRef.current = true;
      try {
        const result = await syncHolidaysForYear(dataDir!, currentYear);
        if (result) {
          setEvents(normalizeEvents(result.merged));
        }
      } catch {
        // 静默失败，不影响正常使用
      }
    }
    doSync();
  }, [dataDir]);

  // 加载开发手记（计数用于热力图，全量用于周报）
  useEffect(() => {
    if (!dataDir) return;
    Promise.all([
      invoke<string>("list_devlog_notes", { dataDir }),
      invoke<string>("read_devlog_tags", { dataDir }),
    ]).then(([notesRaw, tagsRaw]) => {
      const notes = JSON.parse(notesRaw) as { id: string; title: string; content: object; tags: string[]; createdAt?: string; archived?: boolean; progressId?: string; progressAt?: string }[];
      const tagsArr = JSON.parse(tagsRaw) as { id: string; name: string }[];
      const validNotes = Array.isArray(notes) ? notes.filter(n => n.createdAt) : [];
      setDevlogNotes(validNotes as typeof devlogNotes);
      const tagMap: Record<string, string> = {};
      if (Array.isArray(tagsArr)) tagsArr.forEach(t => { tagMap[t.id] = t.name; });
      setDevlogTagMap(tagMap);
      const counts: Record<string, number> = {};
      for (const note of validNotes) {
        const key = note.createdAt!.slice(0, 10);
        counts[key] = (counts[key] ?? 0) + 1;
      }
      setDevlogCounts(counts);
    }).catch(() => {});
  }, [dataDir]);

  const monthSections = useMemo(
    () => months.map((monthKey) => buildMonthSection(parseMonthKey(monthKey), events)),
    [months, events]
  );

  const sidebarDays = useMemo(() => buildMonthGrid(focusMonth), [focusMonth]);

  const upcoming = useMemo(() => {
    const sorted = sortEvents(events);
    const future = sorted.filter((event) => event.startDate >= todayKey || (event.endDate ?? event.startDate) >= todayKey);
    return (future.length > 0 ? future : sorted).slice(0, 10);
  }, [events, todayKey]);

  const [weekStart, weekEnd] = useMemo(() => getWeekRange(today), [today]);
  const weeklyReportData = useMemo(
    () => buildWeeklyReportData(devlogNotes, devlogTagMap, devlogProgress, weekStart, weekEnd),
    [devlogNotes, devlogTagMap, devlogProgress, weekStart, weekEnd]
  );
  const weeklyReportMarkdown = useMemo(
    () => buildWeeklyReportMarkdown(weeklyReportData, devlogTagMap, weekStart, weekEnd),
    [weeklyReportData, devlogTagMap, weekStart, weekEnd]
  );

  useEffect(() => {
    if (didInitialScrollRef.current) return;
    const key = formatMonthKey(initialMonth);
    const scroller = scrollRef.current;
    const el = monthRefs.current[key];
    if (scroller && el) {
      scroller.scrollTop = Math.max(el.offsetTop - 12, 0);
      didInitialScrollRef.current = true;
      setFocusMonth(initialMonth);
    }
  }, [initialMonth, months]);

  useEffect(() => {
    if (!pendingPrependRef.current) return;
    const scroller = scrollRef.current;
    const first = monthRefs.current[pendingPrependRef.current];
    const second = months[1] ? monthRefs.current[months[1]] : null;
    if (scroller && first && second) {
      scroller.scrollTop += second.offsetTop - first.offsetTop;
    }
    pendingPrependRef.current = null;
  }, [months]);

  useEffect(() => {
    if (!editor.open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeEditor();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editor.open, saving]);

  const persistEvents = async (nextEvents: CalendarEvent[]) => {
    const normalized = normalizeEvents(nextEvents);
    setEvents(normalized);
    setSaveError(null);
    if (!dataDir) return;
    setSaving(true);
    try {
      await invoke("write_calendar_events", {
        dataDir,
        json: JSON.stringify(normalized, null, 2),
      });
    } catch (error) {
      setSaveError(String(error));
    } finally {
      setSaving(false);
    }
  };

  const ensureMonthAvailable = (targetMonth: Date) => {
    const targetKey = formatMonthKey(startOfMonth(targetMonth));
    setMonths((current) => {
      if (current.includes(targetKey)) return current;
      let next = [...current];
      while (compareMonthKeys(targetKey, next[0]) < 0) {
        next = [formatMonthKey(addMonths(parseMonthKey(next[0]), -1)), ...next];
      }
      while (compareMonthKeys(targetKey, next[next.length - 1]) > 0) {
        next = [...next, formatMonthKey(addMonths(parseMonthKey(next[next.length - 1]), 1))];
      }
      return next;
    });
  };

  const scrollToMonth = (monthDate: Date) => {
    const monthStart = startOfMonth(monthDate);
    const key = formatMonthKey(monthStart);
    ensureMonthAvailable(monthStart);
    requestAnimationFrame(() => {
      const scroller = scrollRef.current;
      const monthEl = monthRefs.current[key];
      if (scroller && monthEl) {
        scroller.scrollTo({ top: Math.max(monthEl.offsetTop - 12, 0), behavior: "smooth" });
      }
    });
  };

  const handleScroll = () => {
    const scroller = scrollRef.current;
    if (!scroller || months.length === 0) return;

    if (scroller.scrollTop < 240) {
      const prependKey = formatMonthKey(addMonths(parseMonthKey(months[0]), -1));
      pendingPrependRef.current = prependKey;
      setMonths((current) => (current[0] === prependKey ? current : [prependKey, ...current]));
    }

    if (scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop < 420) {
      const appendKey = formatMonthKey(addMonths(parseMonthKey(months[months.length - 1]), 1));
      setMonths((current) =>
        current[current.length - 1] === appendKey ? current : [...current, appendKey]
      );
    }

    const viewportTop = scroller.scrollTop;
    const viewportBottom = viewportTop + scroller.clientHeight;
    let bestKey = months[0];
    let bestArea = 0;

    for (const monthKey of months) {
      const monthEl = monthRefs.current[monthKey];
      if (!monthEl) continue;
      const top = monthEl.offsetTop;
      const bottom = top + monthEl.offsetHeight;
      const overlap = Math.min(bottom, viewportBottom) - Math.max(top, viewportTop);
      if (overlap > bestArea) {
        bestArea = overlap;
        bestKey = monthKey;
      }
    }

    const nextFocus = parseMonthKey(bestKey);
    if (
      nextFocus.getFullYear() !== focusMonth.getFullYear() ||
      nextFocus.getMonth() !== focusMonth.getMonth()
    ) {
      setFocusMonth(nextFocus);
    }
  };

  const openCreateEditor = (date: string) => {
    setEditor({ open: true, draft: createDraft(date) });
    setSaveError(null);
  };

  const openEditEditor = (event: CalendarEvent) => {
    let notesObj: object;
    const raw = event.notes;
    if (isTipTapDoc(raw)) {
      notesObj = raw;
    } else if (typeof raw === "string" && raw.trim()) {
      notesObj = plainTextToTipTapJSON(raw);
    } else {
      notesObj = initialContent();
    }
    setEditor({
      open: true,
      draft: {
        id: event.id,
        title: event.title,
        startDate: event.startDate,
        startTime: event.startTime ?? "",
        endDate: event.endDate ?? event.startDate,
        endTime: event.endTime ?? "",
        color: event.color ?? "blue",
        notes: notesObj,
      },
    });
    setSaveError(null);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditor((current) => ({ ...current, open: false }));
  };

  const updateDraft = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => {
    setEditor((current) => ({
      ...current,
      draft: { ...current.draft, [key]: value },
    }));
  };

  const handleSave = async () => {
    const draft = editor.draft;
    const title = draft.title.trim();
    if (!title) {
      setSaveError("事件标题不能为空");
      return;
    }
    if (draft.endDate < draft.startDate) {
      setSaveError("结束日期不能早于开始日期");
      return;
    }
    if (draft.endDate === draft.startDate && draft.startTime && draft.endTime && draft.endTime < draft.startTime) {
      setSaveError("同一天内结束时间不能早于开始时间");
      return;
    }

    // 仅当备注非空时保存
    const notesObj = draft.notes as { type?: string; content?: unknown[] };
    const hasNotes = notesObj?.type === "doc" && Array.isArray(notesObj.content) && notesObj.content.length > 0;

    const nextEvent: CalendarEvent = {
      id: draft.id ?? createEventId(),
      title,
      startDate: draft.startDate,
      startTime: draft.startTime || undefined,
      endDate: draft.endDate,
      endTime: draft.endTime || undefined,
      color: draft.color,
      notes: hasNotes ? notesObj : undefined,
    };

    const nextEvents = draft.id
      ? events.map((event) => (event.id === draft.id ? nextEvent : event))
      : [...events, nextEvent];

    await persistEvents(nextEvents);
    setEditor((current) => ({ ...current, open: false }));
    scrollToMonth(new Date(`${draft.startDate}T00:00:00`));
  };

  const handleDelete = async () => {
    if (!editor.draft.id) return;
    await persistEvents(events.filter((event) => event.id !== editor.draft.id));
    setEditor((current) => ({ ...current, open: false }));
  };

  return (
    <section className="calendar-shell">
      <aside className="calendar-sidebar">
        <div className="calendar-sidebar-card frosted">
          <div className="calendar-sidebar-header">
            <h3>{MONTH_NAMES[focusMonth.getMonth()]} {focusMonth.getFullYear()} 年</h3>
            <div className="calendar-sidebar-nav">
              <button onClick={() => scrollToMonth(addMonths(focusMonth, -1))} title="上个月">
                <ChevronLeft />
              </button>
              <button onClick={() => scrollToMonth(today)} title="今天">
                <TodayIcon />
              </button>
              <button onClick={() => scrollToMonth(addMonths(focusMonth, 1))} title="下个月">
                <ChevronRight />
              </button>
            </div>
          </div>

          <div className="calendar-mini-weekdays">
            {MINI_WEEKDAY_LABELS.map((day, index) => (
              <span
                key={day}
                className={index === 0 ? "weekend-sunday" : index === 6 ? "weekend-saturday" : ""}
              >
                {day}
              </span>
            ))}
          </div>

          <div className="calendar-mini-grid">
            {sidebarDays.map((date) => {
              const key = formatDateKey(date);
              const isToday = key === todayKey;
              const inMonth = date.getMonth() === focusMonth.getMonth();
              const hasEvents = events.some((event) => overlapsDay(event, key));
              const noteCount = inMonth ? (devlogCounts[key] ?? 0) : 0;
              const heatLevel = noteCount === 0 ? 0 : noteCount === 1 ? 1 : noteCount === 2 ? 2 : noteCount <= 3 ? 3 : 4;
              return (
                <button
                  key={key}
                  className={[
                    "calendar-mini-cell",
                    inMonth ? "" : "muted",
                    isToday ? "today" : "",
                    date.getDay() === 0 ? "weekend-sunday" : "",
                    date.getDay() === 6 ? "weekend-saturday" : "",
                    inMonth && heatLevel > 0 ? `heat-${heatLevel}` : "",
                  ].join(" ").trim()}
                  onClick={() => {
                    scrollToMonth(date);
                    if (noteCount > 0) {
                      pushTool("DevLog");
                      setDevlogDateFilter(key);
                    }
                  }}
                  title={inMonth && noteCount > 0 ? `${noteCount} 条开发手记` : undefined}
                >
                  <span>{date.getDate()}</span>
                  {hasEvents && <i />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="calendar-upcoming frosted">
          <div className="calendar-upcoming-head">
            <h3>最近事件</h3>
            <div className="calendar-upcoming-btn-group">
              <button
                className="calendar-upcoming-add"
                onClick={() => setWeeklyReportOpen(true)}
                title="查看本周周报"
              >
                <WeeklyReportIcon />
              </button>
              <button
                className="calendar-upcoming-add"
                onClick={() => openCreateEditor(todayKey)}
                title="新建事件"
              >
                <PlusIcon />
              </button>
            </div>
          </div>

          <div className="calendar-upcoming-list">
            {upcoming.length === 0 && (
              <div className="calendar-empty-state">还没有事件，可以在右侧日期格中直接创建。</div>
            )}
            {upcoming.map((event) => (
              <button
                key={event.id}
                className={`event-card event-${event.color ?? "blue"}`}
                onClick={() => openEditEditor(event)}
              >
                <div className="event-card-meta">
                  <span>{formatEventDateRange(event)}</span>
                  <span className="calendar-event-countdown">{formatCountdownLabel(today, event)}</span>
                </div>
                <strong>{event.title}</strong>
                <span className="calendar-event-time">{formatEventTimeRange(event)}</span>
                {event.notes && <p>{tipTapToPlainText(event.notes)}</p>}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="calendar-main frosted">
        <div className="calendar-main-top">
          <h3>{formatMonthTitle(focusMonth)}</h3>
          <div className="calendar-main-nav">
            <button onClick={() => scrollToMonth(addMonths(focusMonth, -1))} title="上个月">
              <ChevronLeft />
            </button>
            <button className="calendar-main-today-btn" onClick={() => scrollToMonth(today)} title="今天">
              {formatCompactDate(today)}
            </button>
            <button onClick={() => scrollToMonth(addMonths(focusMonth, 1))} title="下个月">
              <ChevronRight />
            </button>
          </div>
        </div>

        <div className="calendar-grid-weekdays">
          {WEEKDAY_LABELS.map((day, index) => (
            <div
              key={day}
              className={index === 0 ? "weekend-sunday" : index === 6 ? "weekend-saturday" : ""}
            >
              {day}
            </div>
          ))}
        </div>

        <div className="calendar-scroll" ref={scrollRef} onScroll={handleScroll}>
          {monthSections.map((section, sectionIndex) => (
            <section
              key={section.monthKey}
              className={`calendar-month-section ${sectionIndex === 0 ? "is-first" : ""}`}
              ref={(node) => {
                monthRefs.current[section.monthKey] = node;
              }}
            >
              <div className="calendar-month-grid">
                {section.days.map((day) => {
                  if (!day.date) {
                    return (
                      <div
                        key={day.key}
                        className="calendar-grid-cell calendar-grid-cell-empty"
                      />
                    );
                  }
                  const visibleEvents = day.events.slice(0, MAX_CELL_EVENTS);
                  const overflowCount = day.events.length - visibleEvents.length;
                  return (
                    <div
                      key={day.key}
                      className={[
                        "calendar-grid-cell",
                        day.key === todayKey ? "today" : "",
                        day.date.getDay() === 0 ? "weekend-sunday" : "",
                        day.date.getDay() === 6 ? "weekend-saturday" : "",
                      ].join(" ").trim()}
                      onClick={() => openCreateEditor(day.key)}
                    >
                      <div className="calendar-grid-dayhead">
                        <span className="calendar-grid-daynum">{day.date.getDate()}</span>
                        {day.events.length > 0 && (
                          <span className="calendar-grid-daycount">{day.events.length}</span>
                        )}
                      </div>

                      <div className="calendar-grid-events">
                        {visibleEvents.map((event) => (
                          <button
                            key={`${day.key}-${event.id}`}
                            className={`calendar-event-pill event-${event.color ?? "blue"}`}
                            onClick={(mouseEvent) => {
                              mouseEvent.stopPropagation();
                              openEditEditor(event);
                            }}
                          >
                            <span>{formatEventChipTime(event, day.key)}</span>
                            <strong>{event.title}</strong>
                          </button>
                        ))}
                        {overflowCount > 0 && (
                          <span className="calendar-more-events">还有 {overflowCount} 项</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {editor.open && (
        <div className="calendar-modal-backdrop" onClick={closeEditor}>
          <div className="calendar-modal" onClick={(event) => event.stopPropagation()}>
            <div className="calendar-modal-header">
              <h3>{editor.draft.id ? "编辑日历事件" : "创建日历事件"}</h3>
              <button className="calendar-modal-close" onClick={closeEditor}>
                <CloseIcon />
              </button>
            </div>

            <div className="calendar-modal-form">
              <label>
                <span>标题</span>
                <input
                  type="text"
                  value={editor.draft.title}
                  onChange={(event) => updateDraft("title", event.target.value)}
                  placeholder="例如：Review PR"
                />
              </label>

              <div className="calendar-modal-grid">
                <label>
                  <span>开始日期</span>
                  <input
                    type="date"
                    value={editor.draft.startDate}
                    onChange={(event) => updateDraft("startDate", event.target.value)}
                  />
                </label>
                <label>
                  <span>开始时间</span>
                  <input
                    type="time"
                    value={editor.draft.startTime}
                    onChange={(event) => updateDraft("startTime", event.target.value)}
                  />
                </label>
                <label>
                  <span>结束日期</span>
                  <input
                    type="date"
                    value={editor.draft.endDate}
                    onChange={(event) => updateDraft("endDate", event.target.value)}
                  />
                </label>
                <label>
                  <span>结束时间</span>
                  <input
                    type="time"
                    value={editor.draft.endTime}
                    onChange={(event) => updateDraft("endTime", event.target.value)}
                  />
                </label>
              </div>

              <label>
                <span>颜色</span>
                <div className="calendar-color-row">
                  {EVENT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`calendar-color-dot event-${color} ${editor.draft.color === color ? "active" : ""}`}
                      onClick={() => updateDraft("color", color)}
                    />
                  ))}
                </div>
              </label>

              <div className="calendar-notes-label">
                <span>备注</span>
                <div className="calendar-rich-editor">
                  <RichTextEditor
                    key={editor.draft.id ?? "new"}
                    initialContent={editor.draft.notes as object}
                    onChange={(json) => updateDraft("notes", json as EventDraft["notes"])}
                    placeholder="可选备注…"
                    hideLinkToolbar
                  />
                </div>
              </div>

              {saveError && <div className="calendar-error">{saveError}</div>}
            </div>

            <div className="calendar-modal-actions">
              {editor.draft.id && (
                <button className="calendar-danger-btn" onClick={handleDelete} disabled={saving}>
                  删除
                </button>
              )}
              <button className="calendar-ghost-btn" onClick={closeEditor} disabled={saving}>
                取消
              </button>
              <button className="calendar-primary-btn" onClick={handleSave} disabled={saving}>
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {weeklyReportOpen && (() => {
        return (
          <div className="weekly-report-backdrop" onClick={() => setWeeklyReportOpen(false)}>
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
                      className={`weekly-report-mode-btn ${weeklyReportMode === "rich" ? "active" : ""}`}
                      onClick={() => setWeeklyReportMode("rich")}
                    >
                      富文本
                    </button>
                    <button
                      className={`weekly-report-mode-btn ${weeklyReportMode === "markdown" ? "active" : ""}`}
                      onClick={() => setWeeklyReportMode("markdown")}
                    >
                      Markdown
                    </button>
                  </div>
                  <button
                    className={`weekly-report-copy-btn ${reportCopied ? "copied" : ""}`}
                    onClick={() => {
                      const text = weeklyReportMode === "markdown"
                        ? weeklyReportMarkdown
                        : buildWeeklyReportPlainText(weeklyReportData, weekStart, weekEnd);
                      navigator.clipboard.writeText(text).then(() => {
                        setReportCopied(true);
                        setTimeout(() => setReportCopied(false), 2000);
                      });
                    }}
                  >
                    {reportCopied ? "✓ 已复制" : "复制"}
                  </button>
                  <button className="weekly-report-close-btn" onClick={() => setWeeklyReportOpen(false)}>
                    <CloseIcon />
                  </button>
                </div>
              </div>

              <div className="weekly-report-body">
                {weeklyReportMode === "markdown" ? (
                  <pre className="weekly-report-markdown">{weeklyReportMarkdown}</pre>
                ) : (
                  <div className="weekly-report-rich">
                    <div className="weekly-report-rich-summary">
                      <span>本周共统计 {weeklyReportData.total} 条进度记录</span>
                    </div>
                    {weeklyReportData.groups.length === 0 ? (
                      <div className="weekly-report-rich-empty">本周暂无进度切换记录</div>
                    ) : (
                      weeklyReportData.groups.map((group) => (
                        <section key={group.id} className="weekly-report-group">
                          <div className="weekly-report-group-head">
                            <span className="weekly-report-group-dot" style={{ background: group.color }} />
                            <h3>{group.name}</h3>
                            <span className="weekly-report-group-count">{group.items.length} 条</span>
                          </div>
                          <div className="weekly-report-group-list">
                            {group.items.map((item) => {
                              const tagNames = item.tags.map((id) => devlogTagMap[id]).filter(Boolean);
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
        );
      })()}
    </section>
  );
}

function buildMonthSection(monthDate: Date, events: CalendarEvent[]): MonthSection {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const days: CalendarDay[] = [];

  for (let blank = 0; blank < firstDay.getDay(); blank += 1) {
    days.push({
      key: `${formatMonthKey(monthDate)}-lead-${blank}`,
      date: null,
      events: [],
    });
  }

  for (let dayOfMonth = 1; dayOfMonth <= daysInMonth; dayOfMonth += 1) {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), dayOfMonth);
    const key = formatDateKey(date);
    days.push({
      key,
      date,
      events: sortEvents(events.filter((event) => overlapsDay(event, key))),
    });
  }

  const trailing = (7 - (days.length % 7)) % 7;
  for (let blank = 0; blank < trailing; blank += 1) {
    days.push({
      key: `${formatMonthKey(monthDate)}-tail-${blank}`,
      date: null,
      events: [],
    });
  }

  return {
    monthKey: formatMonthKey(monthDate),
    monthDate,
    days,
  };
}

function normalizeEvents(items: CalendarEvent[]) {
  return sortEvents(
    items
      .map((event) => {
        const legacy = event as CalendarEvent & { date?: string; time?: string };
        const startDate = event.startDate ?? legacy.date;
        if (!startDate) return null;
        return {
          ...event,
          id: event.id ?? createEventId(),
          title: event.title ?? "未命名事件",
          startDate,
          startTime: event.startTime ?? legacy.time,
          endDate: event.endDate ?? startDate,
          endTime: event.endTime,
          color: event.color ?? "blue",
          notes: event.notes,
        } as CalendarEvent;
      })
      .filter((event): event is CalendarEvent => Boolean(event))
  );
}

function sortEvents(items: CalendarEvent[]) {
  return [...items].sort((a, b) => {
    const left = `${a.startDate} ${a.startTime ?? "99:99"} ${a.endDate ?? a.startDate}`;
    const right = `${b.startDate} ${b.startTime ?? "99:99"} ${b.endDate ?? b.startDate}`;
    return left.localeCompare(right);
  });
}

function overlapsDay(event: CalendarEvent, dayKey: string) {
  return event.startDate <= dayKey && (event.endDate ?? event.startDate) >= dayKey;
}

function formatEventChipTime(event: CalendarEvent, dayKey: string) {
  const endDate = event.endDate ?? event.startDate;
  const isSingleDay = event.startDate === endDate;
  if (isSingleDay) {
    if (event.startTime && event.endTime) return `${event.startTime}-${event.endTime}`;
    return event.startTime ?? "全天";
  }
  if (dayKey === event.startDate) return event.startTime ? event.startTime : "跨天";
  if (dayKey === endDate) return event.endTime ? event.endTime : "跨天";
  return "跨天";
}

function formatCountdownLabel(today: Date, event: CalendarEvent) {
  const start = parseDateKey(event.startDate);
  const end = parseDateKey(event.endDate ?? event.startDate);
  const todayStart = startOfDay(today).getTime();
  const startTime = start.getTime();
  const endTime = end.getTime();

  if (todayStart >= startTime && todayStart <= endTime) {
    return "今天";
  }
  const diff = Math.round((startTime - todayStart) / 86400000);
  if (diff <= 0) {
    return "已结束";
  }
  if (diff === 1) {
    return "明天";
  }
  if (diff < 7) {
    return `${diff}天后`;
  }
  if (diff < 14) {
    return "下周";
  }
  return `${Math.ceil(diff / 7)}周后`;
}

function createMonthWindow(centerMonth: Date, before: number, after: number) {
  return Array.from({ length: before + after + 1 }, (_, index) =>
    formatMonthKey(addMonths(centerMonth, index - before))
  );
}

function buildMonthGrid(monthDate: Date) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
  );
}

function startOfWeek(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
}

function addDays(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
}

function isSameMonth(date: Date, month: Date) {
  return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
}

function initialContent(): object {
  return { type: "doc", content: [] };
}

function createDraft(date: string): EventDraft {
  return {
    title: "",
    startDate: date,
    startTime: "",
    endDate: date,
    endTime: "",
    color: "blue",
    notes: initialContent(),
  };
}

function createEventId() {
  return globalThis.crypto?.randomUUID?.() ?? `evt-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addMonths(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function formatFullDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}年${m}月${d}日`;
}

function formatMonthTitle(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}年${m}月`;
}

function formatCompactDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function formatDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatMonthKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseMonthKey(value: string) {
  return new Date(`${value}-01T00:00:00`);
}

function compareMonthKeys(left: string, right: string) {
  return parseMonthKey(left).getTime() - parseMonthKey(right).getTime();
}

function formatEventDateRange(event: CalendarEvent) {
  const start = parseDateKey(event.startDate);
  const end = parseDateKey(event.endDate ?? event.startDate);
  const startText = `${start.getMonth() + 1}月${start.getDate()}日`;
  const endText = `${end.getMonth() + 1}月${end.getDate()}日`;
  return event.startDate === (event.endDate ?? event.startDate) ? startText : `${startText} - ${endText}`;
}

function formatEventTimeRange(event: CalendarEvent) {
  if (!event.startTime && !event.endTime) return "全天";
  if (!event.endTime) return `${event.startTime ?? ""} 开始`;
  if (!event.startTime) return `至 ${event.endTime}`;
  return `${event.startTime} - ${event.endTime}`;
}

function parseDateKey(value: string) {
  return new Date(`${value}T00:00:00`);
}

function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
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

function TodayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path d="M8 2v4M16 2v4M8 14h8" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 6v12M6 12h12" />
    </svg>
  );
}

function WeeklyReportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4M16 2v4" />
      <path d="M8 12h5M8 16h8" />
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
  notes: { id: string; title: string; content: object; tags: string[]; createdAt?: string; archived?: boolean; progressId?: string; progressAt?: string }[],
  tagMap: Record<string, string>,
  progressList: { id: string; name: string; color: string }[],
  weekStart: Date,
  weekEnd: Date
): WeeklyReportData {
  const progressLookup = new Map(progressList.map((item) => [item.id, item]));
  const weekNotes = notes
    .filter(n => {
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
  weekEnd: Date
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

function buildWeeklyReportPlainText(data: WeeklyReportData, weekStart: Date, weekEnd: Date): string {
  if (data.total === 0) {
    return `本周工作周报\n${formatFullDate(weekStart)} ~ ${formatFullDate(weekEnd)}\n\n本周暂无进度切换记录`;
  }

  let text = `本周工作周报\n${formatFullDate(weekStart)} ~ ${formatFullDate(weekEnd)}\n共统计 ${data.total} 条进度记录\n`;
  for (const group of data.groups) {
    text += `\n【${group.name}】\n`;
    for (const item of group.items) {
      text += `${formatReportTime(item.progressAt)} ${item.title}\n`;
      const content = tipTapToPlainText(item.content).trim();
      if (content) {
        text += `${content.replace(/\n+/g, " ")}\n`;
      }
    }
  }
  return text.trimEnd();
}

function formatReportTime(value: string): string {
  const dateOnly = value.slice(0, 10);
  const date = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}
