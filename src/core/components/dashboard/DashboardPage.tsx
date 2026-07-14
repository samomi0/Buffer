import { CalendarModule } from "./CalendarModule";
import "./DashboardPage.css";

export function DashboardPage() {
  return (
    <div className="dashboard-shell">
      <div className="dashboard-calendar-page">
        <CalendarModule />
      </div>
    </div>
  );
}
