'use client'

import { useEffect, useRef, useState } from 'react'
import { useViewMode } from './useViewMode'
import { ArrowLeft, ArrowRight, Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ReactNode } from 'react'

/**
 * SlideDeck — paginated slide navigation for presentation mode.
 * Improvements over old Telaclass:
 * - 1-finger horizontal swipe (instead of 3-finger)
 * - Fullscreen toggle
 * - No DOM mutation (all React-driven)
 * - Progress bar at top
 */
export default function SlideDeck({ children }: { children: ReactNode }) {
    const mode = useViewMode()
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [index, setIndex] = useState(0)
    const [ids, setIds] = useState<string[]>([])
    const [title, setTitle] = useState('')
    const [isFullscreen, setIsFullscreen] = useState(false)

    // Collect slide sections (no DOM mutation)
    useEffect(() => {
        if (mode !== 'apresentacao') return
        const root = containerRef.current
        if (!root) return
        const sections: HTMLElement[] = Array.from(root.querySelectorAll('section[data-id]'))
        setIds(sections.map(s => s.dataset.id || '').filter(Boolean))
        const h1 = root.querySelector('h1')
        if (h1) setTitle(h1.textContent?.trim() || '')
        // Restore from hash
        const hash = window.location.hash.replace(/^#/, '')
        if (hash) {
            const idx = sections.findIndex(s => s.dataset.id === hash)
            if (idx >= 0) setIndex(idx)
        }
    }, [mode, children])

    // Keyboard navigation
    useEffect(() => {
        if (mode !== 'apresentacao') return
        const onKey = (e: KeyboardEvent) => {
            const root = containerRef.current
            if (!root) return
            const max = Math.max(0, root.querySelectorAll('section[data-id]').length - 1)
            if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); setIndex(i => Math.min(i + 1, max)) }
            if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)) }
            if (e.key === 'Home') setIndex(0)
            if (e.key === 'End') setIndex(max)
            if (e.key === 'Escape' && isFullscreen) toggleFullscreen()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [mode, isFullscreen])

    // Show/hide slides based on index
    useEffect(() => {
        if (mode !== 'apresentacao') return
        const root = containerRef.current
        if (!root) return
        const sections: HTMLElement[] = Array.from(root.querySelectorAll('section[data-id]'))
        sections.forEach((el, idx) => {
            const show = idx === index
            el.style.display = show ? '' : 'none'
            el.setAttribute('aria-hidden', show ? 'false' : 'true')
        })
        const id = sections[index]?.dataset.id
        if (id) {
            const url = new URL(window.location.href)
            url.hash = id
            window.history.replaceState({}, '', url.toString())
        }
        try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch { window.scrollTo(0, 0) }
    }, [index, mode])

    // 1-finger horizontal swipe (improved from old 3-finger)
    useEffect(() => {
        if (mode !== 'apresentacao') return
        const el = containerRef.current
        if (!el) return

        let startX = 0
        let startY = 0
        let swiping = false

        const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length !== 1) return
            startX = e.touches[0].clientX
            startY = e.touches[0].clientY
            swiping = true
        }

        const onTouchEnd = (e: TouchEvent) => {
            if (!swiping) return
            swiping = false
            const dx = (e.changedTouches[0]?.clientX || 0) - startX
            const dy = (e.changedTouches[0]?.clientY || 0) - startY
            // Only act on mostly-horizontal swipes
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                const max = Math.max(0, ids.length - 1)
                if (dx < -50) setIndex(i => Math.min(i + 1, max))
                else if (dx > 50) setIndex(i => Math.max(i - 1, 0))
            }
        }

        el.addEventListener('touchstart', onTouchStart, { passive: true })
        el.addEventListener('touchend', onTouchEnd, { passive: true })
        return () => {
            el.removeEventListener('touchstart', onTouchStart)
            el.removeEventListener('touchend', onTouchEnd)
        }
    }, [mode, ids.length])

    // Fullscreen toggle
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.parentElement?.requestFullscreen?.()
            setIsFullscreen(true)
        } else {
            document.exitFullscreen?.()
            setIsFullscreen(false)
        }
    }

    useEffect(() => {
        const handler = () => setIsFullscreen(!!document.fullscreenElement)
        document.addEventListener('fullscreenchange', handler)
        return () => document.removeEventListener('fullscreenchange', handler)
    }, [])

    if (mode !== 'apresentacao') {
        return <div ref={containerRef}>{children}</div>
    }

    const progress = ids.length > 1 ? ((index) / (ids.length - 1)) * 100 : 0

    return (
        <div className="presentation-deck relative mx-auto w-full bg-background">
            {/* Progress bar */}
            <div className="sticky top-0 z-30 h-1 w-full bg-muted">
                <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Controls bar */}
            <div className="sticky top-1 z-20 w-full border-b bg-background/85 backdrop-blur flex items-center gap-3 px-3 h-10">
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate" title={title}>{title}</div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setIndex(i => Math.max(i - 1, 0))}
                        aria-label="Slide anterior"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>

                    <span className="text-xs font-medium opacity-70 tabular-nums w-14 text-center select-none">
                        {ids.length ? index + 1 : 0}/{ids.length || 0}
                    </span>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setIndex(i => Math.min(i + 1, Math.max(0, ids.length - 1)))}
                        aria-label="Próximo slide"
                    >
                        <ArrowRight className="h-4 w-4" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={toggleFullscreen}
                        aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                    >
                        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            {/* Slide content */}
            <div ref={containerRef} className="pt-2 px-4" suppressHydrationWarning>
                {children}
            </div>
        </div>
    )
}
