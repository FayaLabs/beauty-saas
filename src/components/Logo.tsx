import React from 'react'

import { asset } from '../assets'

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src={asset('logo.png')} alt="StudioControl" className="h-8 w-8 rounded-lg" />
      {!collapsed && (
        <span className="text-base font-semibold tracking-tight">Studio</span>
      )}
    </div>
  )
}
