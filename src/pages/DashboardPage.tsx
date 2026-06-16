import { TodayScheduleSection } from './dashboard/TodayScheduleSection'
import { QuickActionsSection } from './dashboard/QuickActionsSection'

export function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
      <QuickActionsSection />
      <TodayScheduleSection />
    </div>
  )
}
