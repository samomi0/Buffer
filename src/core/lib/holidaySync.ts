import { invoke } from "@tauri-apps/api/core";

/**
 * 从 APIsBO 拉取并合并当年节假日 / 调休工作日事件。
 * @param force 若为 true，强制刷新并覆盖该年份已有假日数据；否则已有则跳过。
 */
export async function syncHolidaysForYear(
  dataDir: string,
  year: number,
  force = false
): Promise<{ merged: CalendarEvent[]; message: string } | null> {
  const raw = await invoke<string>("read_calendar_events", { dataDir });
  const existing: CalendarEvent[] = JSON.parse(raw || "[]");

  const holidayPrefix = `holiday-${year}-`;
  const workdayPrefix = `workday-${year}-`;

  if (!force) {
    const alreadySynced = existing.some((e) => e.id.startsWith(holidayPrefix));
    if (alreadySynced) return null;
  }

  const apiResp = await invoke<string>("fetch_holidays", { year: String(year) });
  const parsed = JSON.parse(apiResp);
  if (parsed.code !== 0 || !Array.isArray(parsed.data)) {
    throw new Error(`API 返回异常: ${parsed.msg || "未知错误"}`);
  }

  const items = parsed.data as Array<{
    date: string;
    name: string;
    type: string;
  }>;

  // 强制刷新：先移除该年份已有的假日/调休事件
  const others = existing.filter(
    (e) => !e.id.startsWith(holidayPrefix) && !e.id.startsWith(workdayPrefix)
  );

  const newEvents: CalendarEvent[] = [];
  let holidayCount = 0;
  let workdayCount = 0;

  for (let i = 0; i < items.length; i++) {
    const h = items[i];
    const isHoliday = h.type === "holiday";
    const isWorkday = h.type === "workday";
    if (!isHoliday && !isWorkday) continue;

    const color: EventColor = isHoliday ? "holiday" : "workday";
    const notes = isHoliday ? "法定节假日" : "调休工作日";

    newEvents.push({
      id: `${isHoliday ? "holiday" : "workday"}-${year}-${String(i).padStart(3, "0")}`,
      title: h.name,
      startDate: h.date,
      endDate: h.date,
      color,
      notes,
    });

    if (isHoliday) holidayCount++;
    else workdayCount++;
  }

  if (newEvents.length === 0) {
    const merged = force ? others : existing;
    return { merged, message: "该年份暂无节假日数据" };
  }

  const merged = [...others, ...newEvents];
  await invoke("write_calendar_events", {
    dataDir,
    json: JSON.stringify(merged, null, 2),
  });

  return {
    merged,
    message: `已添加 ${holidayCount} 个节假日、${workdayCount} 个调休工作日`,
  };
}

// 与 CalendarModule 共享的类型，避免循环依赖
type EventColor = "red" | "blue" | "green" | "orange" | "holiday" | "workday";

type CalendarEvent = {
  id: string;
  title: string;
  startDate: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  color?: EventColor;
  notes?: string;
};
