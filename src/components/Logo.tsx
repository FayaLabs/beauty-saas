import React from 'react'

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/logo.png" alt="BeautySoft" className="h-8 w-8 rounded-lg" />
      {!collapsed && (
        <span className="text-base font-semibold tracking-tight">
          Beauty<span className="opacity-50 font-normal">Soft</span>
        </span>
      )}
    </div>
  )
}
