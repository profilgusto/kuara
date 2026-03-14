'use client'
import React, { ReactNode } from 'react'
import { useViewMode } from './useViewMode'

/**
 * SlideSecondColumnContent
 * 
 * In text mode, it renders its children normally.
 * In presentation mode, its presence acts as a trigger for SlideDeck to use a
 * two-column layout for the current slide. SlideDeck extracts this content and
 * puts it in the right column, so it renders nothing here inline to avoid duplication.
 */
export default function SlideSecondColumnContent({
    children,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    width = '50%',
}: {
    children: ReactNode
    width?: string
}) {
    const mode = useViewMode()

    // In presentation mode, SlideDeck will extract and render this content
    // in the second column, so we don't render it here inline.
    if (mode === 'apresentacao') return null

    // In text mode, just render the content normally
    return (
        <div className="slide-second-column-content my-4 p-4 border rounded bg-muted/30">
            {children}
        </div>
    )
}
