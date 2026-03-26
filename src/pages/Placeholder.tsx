import React from 'react'

export function createPlaceholder(title: string, description?: string): React.FC {
  return function PlaceholderPage() {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        {description && (
          <p className="mt-1 text-muted-foreground">{description}</p>
        )}
        <div className="mt-8 flex items-center justify-center rounded-card border border-dashed border-border bg-card p-16">
          <div className="text-center">
            <p className="text-lg font-medium text-muted-foreground">Coming Soon</p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              This module is being built as a plugin.
            </p>
          </div>
        </div>
      </div>
    )
  }
}
