import React, { useState } from 'react'
import { ModulePage, type ModuleNavItem } from '@fayz/saas-core'
import { Send, TrendingUp, Users, Mail } from 'lucide-react'

function StatCard({ icon: Icon, value, label, sub, color }: { icon: React.ElementType; value: string; label: string; sub: string; color: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  )
}

function OverviewView() {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Send} value="5" label="Active Campaigns" sub="2 new this week" color="bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400" />
        <StatCard icon={Mail} value="1,247" label="Messages Sent" sub="This month" color="bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400" />
        <StatCard icon={TrendingUp} value="78%" label="Open Rate" sub="+5% vs last month" color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" />
        <StatCard icon={Users} value="423" label="Clients Reached" sub="Last 30 days" color="bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Campaign Performance */}
        <div className="rounded-lg border bg-card p-5">
          <h3 className="text-base font-semibold mb-1">Campaign Performance</h3>
          <p className="text-xs text-muted-foreground mb-4">Metrics from recent campaigns</p>
          <div className="space-y-3">
            {[
              { name: 'Birthday', sent: 150, opened: 120, clicked: 35 },
              { name: 'Return', sent: 200, opened: 140, clicked: 45 },
              { name: 'Promotion', sent: 300, opened: 250, clicked: 80 },
              { name: 'Reactivation', sent: 100, opened: 60, clicked: 12 },
            ].map((c) => (
              <div key={c.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground">{c.sent} sent</span>
                </div>
                <div className="flex gap-0.5 h-5">
                  <div className="rounded-sm bg-zinc-400 dark:bg-zinc-600 flex items-center justify-center text-[9px] text-white font-medium" style={{ width: `${(c.sent / 300) * 100}%` }}>{c.sent}</div>
                  <div className="rounded-sm bg-emerald-500 flex items-center justify-center text-[9px] text-white font-medium" style={{ width: `${(c.opened / 300) * 100}%` }}>{c.opened}</div>
                  <div className="rounded-sm bg-orange-500 flex items-center justify-center text-[9px] text-white font-medium" style={{ width: `${(c.clicked / 300) * 100}%` }}>{c.clicked}</div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-zinc-400" /> Sent</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> Opened</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-orange-500" /> Clicked</span>
            </div>
          </div>
        </div>

        {/* Channel Distribution */}
        <div className="rounded-lg border bg-card p-5">
          <h3 className="text-base font-semibold mb-1">Channel Distribution</h3>
          <p className="text-xs text-muted-foreground mb-4">Messages sent by channel</p>
          <div className="flex items-center justify-center py-6">
            {/* Simple donut representation */}
            <div className="relative">
              <svg viewBox="0 0 120 120" className="h-40 w-40">
                {/* WhatsApp 65% */}
                <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="20" className="text-violet-500"
                  strokeDasharray="204 314" strokeDashoffset="0" transform="rotate(-90 60 60)" />
                {/* Email 25% */}
                <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="20" className="text-blue-500"
                  strokeDasharray="78.5 314" strokeDashoffset="-204" transform="rotate(-90 60 60)" />
                {/* SMS 10% */}
                <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="20" className="text-emerald-500"
                  strokeDasharray="31.4 314" strokeDashoffset="-282.5" transform="rotate(-90 60 60)" />
              </svg>
            </div>
          </div>
          <div className="flex items-center justify-center gap-6 text-xs">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-violet-500" /> WhatsApp 65%</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-blue-500" /> Email 25%</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-emerald-500" /> SMS 10%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Marketing() {
  const [activeView, setActiveView] = useState('overview')

  const nav: ModuleNavItem[] = [
    { id: 'overview', label: 'Overview', icon: 'BarChart3', active: activeView === 'overview', onClick: () => setActiveView('overview') },
    {
      id: 'automations', label: 'Automations', icon: 'Settings',
      children: [
        { id: 'auto-list', label: 'List', onClick: () => setActiveView('automations') },
        { id: 'auto-new', label: 'New Automation', onClick: () => setActiveView('new-automation') },
      ],
    },
    {
      id: 'campaigns', label: 'Campaigns', icon: 'Megaphone',
      children: [
        { id: 'camp-active', label: 'Active', onClick: () => setActiveView('campaigns-active') },
        { id: 'camp-draft', label: 'Drafts', onClick: () => setActiveView('campaigns-draft') },
        { id: 'camp-completed', label: 'Completed', onClick: () => setActiveView('campaigns-completed') },
      ],
    },
    {
      id: 'segments', label: 'Segments', icon: 'Users',
      children: [
        { id: 'seg-all', label: 'All Segments', onClick: () => setActiveView('segments') },
        { id: 'seg-new', label: 'New Segment', onClick: () => setActiveView('new-segment') },
      ],
    },
    {
      id: 'channels', label: 'Channels', icon: 'Mail',
      children: [
        { id: 'ch-whatsapp', label: 'WhatsApp', onClick: () => setActiveView('whatsapp') },
        { id: 'ch-email', label: 'Email', onClick: () => setActiveView('email') },
        { id: 'ch-sms', label: 'SMS', onClick: () => setActiveView('sms') },
      ],
    },
    { id: 'history', label: 'Send History', icon: 'Clock' },
    {
      id: 'reports', label: 'Reports', icon: 'BarChart3',
      children: [
        { id: 'rep-campaigns', label: 'Campaigns', onClick: () => setActiveView('report-campaigns') },
        { id: 'rep-channels', label: 'Channels', onClick: () => setActiveView('report-channels') },
        { id: 'rep-engagement', label: 'Engagement', onClick: () => setActiveView('report-engagement') },
      ],
    },
    { id: 'triggers', label: 'Quick Triggers', icon: 'Target' },
    { id: 'booking', label: 'Online Booking', icon: 'Calendar' },
  ]

  return (
    <ModulePage title="Marketing" subtitle="Campaign and automation overview" nav={nav}>
      <OverviewView />
    </ModulePage>
  )
}
