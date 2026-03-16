// components/mdx/useViewMode.ts
// Shared view mode state (text vs presentation) for the Telaclass content viewer.
'use client'
import React, { useEffect, createContext, useContext, ReactNode, useSyncExternalStore } from 'react'

export type ViewMode = 'texto' | 'apresentacao'

function readModeFromStorage(): ViewMode {
    try {
        const saved = localStorage.getItem('view-mode') as ViewMode | null
        return saved === 'apresentacao' ? 'apresentacao' : 'texto'
    } catch {
        return 'texto'
    }
}

function subscribeToViewMode(callback: () => void): () => void {
    window.addEventListener('telaclass:view-mode', callback)
    return () => window.removeEventListener('telaclass:view-mode', callback)
}

const ViewModeOverrideContext = createContext<ViewMode | null>(null)

export function useViewMode(): ViewMode {
    const override = useContext(ViewModeOverrideContext)

    // useSyncExternalStore reads from localStorage synchronously during render,
    // including the initial render after a component remounts. This avoids the
    // useState('texto') + useEffect flush pattern, which caused TextOnly/PresentOnly
    // to flash wrong content when Slide switched DOM structures between modes.
    const storedMode = useSyncExternalStore(
        subscribeToViewMode,
        readModeFromStorage,        // client snapshot: reads localStorage synchronously
        () => 'texto' as ViewMode,  // server snapshot: safe default for SSR/hydration
    )

    // Force text mode when the screen shrinks below the md breakpoint
    useEffect(() => {
        if (override) return
        const mq = window.matchMedia('(max-width: 767.98px)')
        const apply = () => {
            if (mq.matches) setViewMode('texto')
        }
        apply()
        mq.addEventListener('change', apply)
        return () => mq.removeEventListener('change', apply)
    }, [override])

    return override ?? storedMode
}

export function ViewModeProvider({ mode, children }: { mode: ViewMode; children: ReactNode }) {
    return React.createElement(ViewModeOverrideContext.Provider, { value: mode }, children)
}

export function setViewMode(next: ViewMode) {
    if (typeof window === 'undefined') return
    try {
        if (window.matchMedia('(max-width: 767.98px)').matches && next === 'apresentacao') {
            next = 'texto'
        }
    } catch { }
    try { localStorage.setItem('view-mode', next) } catch { }
    window.dispatchEvent(new Event('telaclass:view-mode'))
}
