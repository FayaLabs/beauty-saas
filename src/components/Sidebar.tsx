import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Calendar, Users, Scissors, Package, DollarSign, BarChart2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/agenda', label: 'Agenda', icon: Calendar },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/services', label: 'Services', icon: Scissors },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/financial', label: 'Financial', icon: DollarSign },
  { to: '/reports', label: 'Reports', icon: BarChart2 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-border">
      <div className="px-4 py-5 font-bold text-lg tracking-tight">BeautySoft</div>
      <nav className="flex-1 px-2 space-y-1">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                  : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
