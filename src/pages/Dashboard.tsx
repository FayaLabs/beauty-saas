import React from 'react'
import { Card } from '@fayz/saas-core/components'
import { Badge } from '@fayz/saas-core/components'
import { Button } from '@fayz/saas-core/components'

const stats = [
  { label: "Today's Appointments", value: '12', change: '+2 from yesterday', icon: '📅' },
  { label: 'Revenue (This Week)', value: '$3,240', change: '+15% vs last week', icon: '💰' },
  { label: 'Active Clients', value: '148', change: '+8 this month', icon: '👤' },
  { label: 'Avg. Rating', value: '4.9', change: '32 reviews', icon: '⭐' },
]

const upcomingAppointments = [
  { time: '9:00 AM', client: 'Sarah Johnson', service: 'Balayage + Cut', stylist: 'Maria', duration: '2h 30m', status: 'confirmed' as const },
  { time: '10:00 AM', client: 'Emily Chen', service: 'Manicure + Pedicure', stylist: 'Lisa', duration: '1h 15m', status: 'confirmed' as const },
  { time: '11:30 AM', client: 'Rachel Kim', service: 'Facial Treatment', stylist: 'Anna', duration: '1h', status: 'pending' as const },
  { time: '1:00 PM', client: 'Jessica Lee', service: 'Haircut & Blowout', stylist: 'Maria', duration: '45m', status: 'confirmed' as const },
  { time: '2:30 PM', client: 'Amanda White', service: 'Full Set Acrylics', stylist: 'Lisa', duration: '1h 30m', status: 'confirmed' as const },
]

export function Dashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Good morning, Maria!</h1>
        <p className="text-muted-foreground mt-1">Here's what's happening at BeautySoft today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <span className="text-2xl">{stat.icon}</span>
            </div>
            <p className="text-3xl font-bold mt-2">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
          </Card>
        ))}
      </div>

      {/* Today's Schedule */}
      <Card>
        <div className="p-5 border-b">
          <h2 className="text-lg font-semibold">Today's Schedule</h2>
        </div>
        <div className="divide-y">
          {upcomingAppointments.map((apt, i) => (
            <div key={i} className="p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors">
              <div className="w-20 text-sm font-medium text-primary">{apt.time}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{apt.client}</p>
                <p className="text-sm text-muted-foreground">{apt.service} • {apt.duration}</p>
              </div>
              <div className="text-sm text-muted-foreground hidden sm:block">{apt.stylist}</div>
              <Badge variant={apt.status === 'confirmed' ? 'default' : 'secondary'}>
                {apt.status}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'New Appointment', icon: '➕' },
          { label: 'Walk-in Client', icon: '🚶' },
          { label: 'Send Reminder', icon: '💬' },
          { label: 'End of Day Report', icon: '📊' },
        ].map((action) => (
          <Button
            key={action.label}
            variant="outline"
            className="flex flex-col items-center gap-2 p-4 h-auto"
          >
            <span className="text-2xl">{action.icon}</span>
            <span className="text-sm font-medium">{action.label}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}
