import React from 'react'
import { Card, Button } from '@fayz/saas-core/components'

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hours = ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM']

const appointments = [
  { day: 0, startHour: 0, span: 2, client: 'Sarah J.', service: 'Balayage', color: 'bg-primary/10 text-primary border-primary/20' },
  { day: 0, startHour: 4, span: 1, client: 'Emily C.', service: 'Haircut', color: 'bg-accent/10 text-accent border-accent/20' },
  { day: 1, startHour: 1, span: 1, client: 'Rachel K.', service: 'Facial', color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' },
  { day: 1, startHour: 3, span: 2, client: 'Jessica L.', service: 'Full Color', color: 'bg-primary/10 text-primary border-primary/20' },
  { day: 2, startHour: 0, span: 1, client: 'Amanda W.', service: 'Manicure', color: 'bg-success/10 text-success border-success/20' },
  { day: 2, startHour: 2, span: 1, client: 'Nicole B.', service: 'Pedicure', color: 'bg-success/10 text-success border-success/20' },
  { day: 3, startHour: 1, span: 3, client: 'Sarah J.', service: 'Highlights', color: 'bg-primary/10 text-primary border-primary/20' },
  { day: 4, startHour: 0, span: 1, client: 'Emily C.', service: 'Gel Nails', color: 'bg-success/10 text-success border-success/20' },
  { day: 4, startHour: 5, span: 2, client: 'Rachel K.', service: 'Hydra Facial', color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' },
  { day: 5, startHour: 0, span: 1, client: 'Walk-in', service: 'Blowout', color: 'bg-muted text-muted-foreground border-border' },
  { day: 5, startHour: 2, span: 2, client: 'Jessica L.', service: 'Balayage', color: 'bg-primary/10 text-primary border-primary/20' },
]

export function Appointments() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Appointments</h1>
          <p className="text-muted-foreground">Week of Mar 9 – 15, 2026</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">← Prev</Button>
          <Button size="sm">Today</Button>
          <Button variant="outline" size="sm">Next →</Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Header */}
            <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b bg-muted/50">
              <div className="p-3"></div>
              {days.map((day, i) => (
                <div key={day} className="p-3 text-center text-sm font-medium">
                  <span className="text-muted-foreground">{day}</span>
                  <span className={`block text-lg mt-0.5 ${i === 2 ? 'bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center mx-auto' : ''}`}>
                    {9 + i}
                  </span>
                </div>
              ))}
            </div>

            {/* Time Slots */}
            {hours.map((hour, hourIdx) => (
              <div key={hour} className="grid grid-cols-[80px_repeat(7,1fr)] border-b last:border-0">
                <div className="p-2 text-xs text-muted-foreground text-right pr-3 pt-1">{hour}</div>
                {days.map((_, dayIdx) => {
                  const apt = appointments.find((a) => a.day === dayIdx && a.startHour === hourIdx)
                  return (
                    <div key={dayIdx} className="border-l min-h-[52px] relative p-0.5">
                      {apt && (
                        <div
                          className={`absolute inset-x-0.5 top-0.5 rounded-md border px-2 py-1 text-xs cursor-pointer hover:opacity-80 transition-opacity ${apt.color}`}
                          style={{ height: `${apt.span * 52 - 4}px`, zIndex: 10 }}
                        >
                          <p className="font-medium truncate">{apt.client}</p>
                          <p className="truncate opacity-75">{apt.service}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
