import { CalendarModule } from "./CalendarModule";
import "./CalendarPage.css";

export function CalendarPage() {
  return (
    <div className="calendar-page-shell">
      <div className="calendar-page-content">
        <CalendarModule />
      </div>
    </div>
  );
}
