'use client'

import React, { ReactNode } from 'react'
import { ViewModeProvider } from './useViewMode'
import { ModuleContext } from './ModuleContext'
import ViewToggle from './ViewToggle'
import SlideDeck from './SlideDeck'

export function ModulePageClient({
    children,
    title,
}: {
    children: ReactNode
    title: string
}) {
    return (
        <ModuleContext.Provider value={{ title }}>
            <div className="flex items-center justify-between mb-8 gap-4">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{title}</h1>
                {/* Toggle appears on md+ screens to switch between Text and Presentation mode */}
                <ViewToggle />
            </div>

            {/* SlideDeck wrapper only affects rendering when mode='apresentacao' */}
            <SlideDeck>
                {children}
            </SlideDeck>
        </ModuleContext.Provider>
    )
}
