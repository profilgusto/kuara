// components/mdx/useViewMode.ts
// Shared view mode state (text vs presentation) for the Telaclass content viewer.
'use client'
import React, { useEffect, useState, createContext, useContext, ReactNode } from 'react'

export type ViewMode = 'texto' | 'apresentacao'

function readModeFromStorage(): ViewMode {
    try {
        const saved = localStorage.getItem('view-mode') as ViewMode | null
        return saved || 'texto'
    } catch {
        return 'texto'
    }
}

const ViewModeOverrideContext = createContext<ViewMode | null>(null)

export function useViewMode(): ViewMode {
    const override = useContext(ViewModeOverrideContext)
    if (override) return override

    const [mode, setMode] = useState<ViewMode>('texto')

    useEffect(() => {
        const sync = () => setMode(readModeFromStorage())
        sync()
        window.addEventListener('telaclass:view-mode', sync as any)
        return () => window.removeEventListener('telaclass:view-mode', sync as any)
    }, [])

    // Force text mode on small screens
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 767.98px)')
        const apply = () => {
            if (mq.matches && mode !== 'texto') {
                setMode('texto')
                try { localStorage.setItem('view-mode', 'texto') } catch { }
            }
        }
        apply()
        mq.addEventListener('change', apply)
        return () => mq.removeEventListener('change', apply)
    }, [mode])

    useEffect(() => {
        try { localStorage.setItem('view-mode', mode) } catch { }
    }, [mode])

    return mode
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
