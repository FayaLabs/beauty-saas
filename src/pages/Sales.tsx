import React, { useState } from 'react'
import { ModulePage, type ModuleNavItem } from '@fayz/saas-core'
import { TrendingUp, Users, Target, DollarSign, Star, AlertCircle, ArrowDown } from 'lucide-react'

function StatCard({ icon: Icon, value, label, change, changeColor }: { icon: React.ElementType; value: string; label: string; change: string; changeColor: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className={`text-xs font-medium ${changeColor}`}>{change}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}

function FunnelStage({ label, value, percent, width, color }: { label: string; value: number; percent: string; width: string; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">{value} <span className="text-xs">({percent})</span></span>
      </div>
      <div className="h-8 rounded-md bg-muted/50 overflow-hidden">
        <div className={`h-full rounded-md flex items-center justify-center text-xs font-medium text-white ${color}`} style={{ width }}>{percent}</div>
      </div>
      <div className="flex justify-center"><ArrowDown className="h-3 w-3 text-muted-foreground/40" /></div>
    </div>
  )
}

function OverviewView() {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} value="450" label="Total Leads" change="+23%" changeColor="text-emerald-600" />
        <StatCard icon={Target} value="12.5%" label="Conversion Rate" change="+2.3%" changeColor="text-emerald-600" />
        <StatCard icon={DollarSign} value="R$ 38.200" label="Monthly Revenue" change="+15%" changeColor="text-emerald-600" />
        <StatCard icon={AlertCircle} value="18" label="Pending Follow-ups" change="Urgent" changeColor="text-destructive" />
      </div>

      {/* Funnel + Chart */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-5">
          <h3 className="text-base font-semibold mb-1">Sales Funnel</h3>
          <p className="text-xs text-muted-foreground mb-4">Client journey</p>
          <div className="space-y-1">
            <FunnelStage label="Visitors" value={1200} percent="100%" width="100%" color="bg-blue-500" />
            <FunnelStage label="Leads" value={450} percent="37.5%" width="37.5%" color="bg-violet-500" />
            <FunnelStage label="Opportunities" value={180} percent="40%" width="15%" color="bg-amber-500" />
            <FunnelStage label="Proposals" value={80} percent="44.4%" width="6.7%" color="bg-orange-500" />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Closed</span>
                <span className="text-sm text-muted-foreground">45 <span className="text-xs">(56.3%)</span></span>
              </div>
              <div className="h-8 rounded-md bg-muted/50 overflow-hidden">
                <div className="h-full rounded-md flex items-center justify-center text-xs font-medium text-white bg-emerald-500" style={{ width: '3.75%' }}>3.75%</div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <h3 className="text-base font-semibold mb-1">Conversion by Origin</h3>
          <p className="text-xs text-muted-foreground mb-4">Leads vs Clients by channel</p>
          <div className="space-y-3">
            {[
              { label: 'Instagram', leads: 180, converted: 45 },
              { label: 'WhatsApp', leads: 120, converted: 38 },
              { label: 'Referral', leads: 90, converted: 42 },
              { label: 'Google', leads: 60, converted: 15 },
            ].map((ch) => (
              <div key={ch.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{ch.label}</span>
                  <span className="font-medium">{ch.converted}/{ch.leads}</span>
                </div>
                <div className="flex gap-1 h-3">
                  <div className="rounded-sm bg-blue-500" style={{ width: `${(ch.leads / 180) * 100}%` }} />
                  <div className="rounded-sm bg-emerald-500" style={{ width: `${(ch.converted / 180) * 100}%` }} />
                </div>
              </div>
            ))}
            <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-500" /> Leads</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> Converted</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Sales() {
  const [activeView, setActiveView] = useState('overview')

  const nav: ModuleNavItem[] = [
    { id: 'overview', label: 'Overview', icon: 'BarChart3', active: activeView === 'overview', onClick: () => setActiveView('overview') },
    { id: 'journey', label: 'Client Journey', icon: 'Users', onClick: () => setActiveView('journey') },
    { id: 'funnel', label: 'Sales Funnel', icon: 'Filter', onClick: () => setActiveView('funnel') },
    {
      id: 'quotes', label: 'Quotes', icon: 'FileText',
      children: [
        { id: 'quote-list', label: 'List', onClick: () => setActiveView('quotes') },
        { id: 'quote-new', label: 'New Quote', onClick: () => setActiveView('new-quote') },
      ],
    },
    {
      id: 'leads', label: 'Leads', icon: 'Target',
      children: [
        { id: 'lead-list', label: 'List Leads', onClick: () => setActiveView('leads') },
        { id: 'lead-new', label: 'New Lead', onClick: () => setActiveView('new-lead') },
        { id: 'opportunities', label: 'Opportunities', onClick: () => setActiveView('opportunities') },
      ],
    },
    {
      id: 'clients', label: 'Clients', icon: 'Users',
      children: [
        { id: 'potential', label: 'Potential', onClick: () => setActiveView('potential') },
        { id: 'active', label: 'Active', onClick: () => setActiveView('active') },
        { id: 'inactive', label: 'Inactive', onClick: () => setActiveView('inactive') },
        { id: 'vip', label: 'VIP', onClick: () => setActiveView('vip') },
      ],
    },
    { id: 'engagement', label: 'Engagement', icon: 'Heart' },
    { id: 'loyalty', label: 'Loyalty', icon: 'Star' },
  ]

  return (
    <ModulePage title="Sales" subtitle="Client relationship management" nav={nav}>
      <OverviewView />
    </ModulePage>
  )
}
