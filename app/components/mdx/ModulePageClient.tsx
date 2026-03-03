'use client'

import React, { ReactNode } from 'react'
import { ViewModeProvider } from './useViewMode'
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
        <>
            <div className="flex items-center justify-between mb-8 gap-4">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
                {/* Toggle appears on md+ screens to switch between Text and Presentation mode */}
                <ViewToggle />
            </div>

            {/* SlideDeck wrapper only affects rendering when mode='apresentacao' */}
            <SlideDeck>
                {children}
            </SlideDeck>
        </>
    )
}
