'use client'

import React, { ReactNode, useState, useMemo } from 'react'
import { useViewMode } from './useViewMode'
import { SlideSecondColumnContext, type SlideSecondColumnContextValue } from './SlideSecondColumnContext'

type SecondCol = { content: ReactNode; width: string } | null

export default function Slide({
    children,
    isCover = false,
    ...rest
}: { children: ReactNode, isCover?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
    const mode = useViewMode()
    const [secondCol, setSecondCol] = useState<SecondCol>(null)

    // Stable context value — SlideSecondColumnContent calls register/clear
    // via useLayoutEffect so registration happens before paint.
    const ctx = useMemo<SlideSecondColumnContextValue>(() => ({
        register: (content: ReactNode, width: string) => setSecondCol({ content, width }),
        clear: () => setSecondCol(null),
    }), [])

    if (mode !== 'apresentacao') {
        // Text mode: pass all children through as-is.
        // SlideSecondColumnContent handles its own text-mode visibility.
        return (
            <SlideSecondColumnContext.Provider value={ctx}>
                <section {...rest} className="mdx-slide-segment my-6">
                    {children}
                </section>
            </SlideSecondColumnContext.Provider>
        )
    }

    return (
        <SlideSecondColumnContext.Provider value={ctx}>
            <section
                {...rest}
                data-cover={isCover ? "true" : undefined}
                className={[
                    'relative flex flex-col min-h-[400px]',
                    isCover
                        ? 'w-full h-full p-0 m-0 rounded-none shadow-none bg-transparent'
                        : 'mx-auto my-2 max-w-4xl px-6 py-6 pb-12 rounded-2xl shadow-sm bg-[var(--bg)] text-[var(--fg)] w-full'
                ].filter(Boolean).join(' ')}
            >
                {secondCol ? (
                    // Two-column layout: main content left, registered second column right.
                    // SlideSecondColumnContent is still in {children} but returns null in
                    // presentation mode, so the left column shows only the main content.
                    <div className="slide-layout-horizontal h-full flex flex-col">
                        <div className="flex-1 flex flex-row gap-6 lg:gap-8 items-start min-h-0">
                            <div
                                className="slide-main-content space-y-4 overflow-y-auto pr-2"
                                style={{ flex: `0 0 calc(100% - ${secondCol.width} - 1.5rem)` }}
                            >
                                {children}
                            </div>
                            <div
                                className="slide-second-col-content space-y-4 overflow-y-auto"
                                style={{ flex: `0 0 ${secondCol.width}` }}
                            >
                                {secondCol.content}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="slide-layout-vertical space-y-4">
                        {children}
                    </div>
                )}
            </section>
        </SlideSecondColumnContext.Provider>
    )
}
