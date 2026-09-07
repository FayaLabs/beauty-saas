import React from 'react'

import { asset } from '../assets'

export function Logo({ collapsed, full }: { collapsed?: boolean; full?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src={asset('logo.png')} alt="StudioControl" className="h-8 w-8 rounded-lg" />
      {/* Por dentro do app o nome é só a vertical; por fora (login, páginas
          públicas) vai o lockup inteiro, com o sufixo meio tom abaixo. */}
      {!collapsed && (
        <span className="text-base font-bold tracking-tight">
          Studio
          {full && <span className="font-semibold opacity-60">Control</span>}
        </span>
      )}
    </div>
  )
}
