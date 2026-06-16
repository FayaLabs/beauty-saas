import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Calendar, Users, Scissors, Package, DollarSign, BarChart2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/agenda', icon: Calendar, label: 'Agenda' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/services', icon: Scissors, label: 'Services' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/financial', icon: DollarSign, label: 'Financial' },
  { to: '/reports', icon: BarChart2, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  return (
    <aside className="w-56 border-r bg-sidebar flex flex-col h-full shrink-0">
      <div className="h-14 flex items-center px-4 border-b">
        <span className="font-semibold text-sidebar-foreground text-lg">BeautySoft</span>
      </div>
      <nav className="flex-1 py-4 px-2 space-y-1">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
              )
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
