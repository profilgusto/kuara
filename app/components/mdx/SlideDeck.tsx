'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useViewMode } from './useViewMode'
import { ArrowLeft, ArrowRight, Maximize2, Minimize2, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ReactNode } from 'react'

export default function SlideDeck({ children }: { children: ReactNode }) {
    const mode = useViewMode()
    const deckRef = useRef<HTMLDivElement | null>(null)
    const containerRef = useRef<HTMLDivElement | null>(null)
    const outerAreaRef = useRef<HTMLDivElement | null>(null)
    const [index, setIndex] = useState(0)
    const [ids, setIds] = useState<string[]>([])
    const [title, setTitle] = useState('')
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [contentScale, setContentScale] = useState(1.0)

    const adjustContentScale = (delta: number) =>
        setContentScale(s => Math.min(2.0, Math.max(0.5, Math.round((s + delta) * 10) / 10)))

    // Reset content scale when leaving fullscreen
    useEffect(() => { if (!isFullscreen) setContentScale(1.0) }, [isFullscreen])

    // Zoom/pan state kept in a ref for synchronous access inside event handlers
    const transformRef = useRef({ zoom: 1, panX: 0, panY: 0 })
    const [transform, setTransform] = useState({ zoom: 1, panX: 0, panY: 0 })

    const applyTransform = (fn: (t: typeof transformRef.current) => typeof transformRef.current) => {
        const next = fn(transformRef.current)
        transformRef.current = next
        setTransform({ ...next })
    }

    // Collect slide sections (no DOM mutation, just reading)
    useEffect(() => {
        if (mode !== 'apresentacao') return
        const root = containerRef.current
        if (!root) return

        // Wait a tick for DOM to be fully hydrated
        requestAnimationFrame(() => {
            const sections: HTMLElement[] = Array.from(root.querySelectorAll('section[data-id]'))
            setIds(sections.map(s => s.dataset.id || '').filter(Boolean))

            // After a preview reload, PreviewRefreshScript saves the current slide ID to
            // sessionStorage before window.location.reload(). We restore from there first
            // because the URL hash may be overwritten by the show/hide effect before we read it.
            const savedSlideId = sessionStorage.getItem('preview-slide-id')
            if (savedSlideId) {
                sessionStorage.removeItem('preview-slide-id')
                const idx = sections.findIndex(s => s.dataset.id === savedSlideId)
                if (idx >= 0) { setIndex(idx); return }
            }

            // Fall back to URL hash (e.g. normal page navigation)
            const hash = window.location.hash.replace(/^#/, '')
            if (hash) {
                const idx = sections.findIndex(s => s.dataset.id === hash)
                if (idx >= 0) setIndex(idx)
            }
        })
    }, [mode, children])

    // Keyboard navigation
    useEffect(() => {
        if (mode !== 'apresentacao') return
        const onKey = (e: KeyboardEvent) => {
            const max = Math.max(0, ids.length - 1)
            if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); setIndex(i => Math.min(i + 1, max)) }
            if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)) }
            if (e.key === 'Home') setIndex(0)
            if (e.key === 'End') setIndex(max)
            if (e.key === 'Escape' && isFullscreen) toggleFullscreen()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [mode, isFullscreen, ids.length])

    // Show/hide slides: cross-fade via opacity, all slides stacked absolutely
    useEffect(() => {
        if (mode !== 'apresentacao') return
        const root = containerRef.current
        if (!root) return
        const sections: HTMLElement[] = Array.from(root.querySelectorAll('section[data-id]'))
        sections.forEach((el, idx) => {
            const show = idx === index
            el.style.position = 'absolute'
            el.style.inset = '0'
            el.style.overflowY = 'auto'
            el.style.transition = 'opacity 280ms ease-in-out'
            el.style.opacity = show ? '1' : '0'
            el.style.pointerEvents = show ? '' : 'none'
            el.setAttribute('aria-hidden', show ? 'false' : 'true')
        })
        const activeSection = sections[index]
        if (activeSection) {
            const t = activeSection.dataset.title
            if (t) setTitle(t)

            const id = activeSection.dataset.id
            if (id) {
                const url = new URL(window.location.href)
                url.hash = id
                window.history.replaceState({}, '', url.toString())
            }
            // Scroll active slide back to top
            activeSection.scrollTop = 0
        }
        // Reset zoom/pan on slide change
        applyTransform(() => ({ zoom: 1, panX: 0, panY: 0 }))
        try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch { window.scrollTo(0, 0) }
    }, [index, mode, ids.length])

    // 1-finger horizontal swipe
    useEffect(() => {
        if (mode !== 'apresentacao') return
        const el = outerAreaRef.current
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

    // Trackpad pinch-to-zoom (ctrlKey + wheel) and pan when zoomed in
    useEffect(() => {
        if (mode !== 'apresentacao') return
        const el = outerAreaRef.current
        if (!el) return

        const onWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                // Pinch-to-zoom: zoom centered on cursor position
                e.preventDefault()
                const rect = el.getBoundingClientRect()
                const mx = e.clientX - rect.left - rect.width / 2
                const my = e.clientY - rect.top - rect.height / 2

                applyTransform(({ zoom, panX, panY }) => {
                    const factor = e.deltaY > 0 ? 0.95 : 1.05
                    const newZoom = Math.max(0.5, Math.min(4, zoom * factor))
                    const ratio = newZoom / zoom
                    return {
                        zoom: newZoom,
                        panX: mx * (1 - ratio) + panX * ratio,
                        panY: my * (1 - ratio) + panY * ratio,
                    }
                })
            } else if (transformRef.current.zoom > 1) {
                // Pan when zoomed in (two-finger scroll without pinch)
                e.preventDefault()
                applyTransform(({ zoom, panX, panY }) => ({
                    zoom,
                    panX: panX - e.deltaX / zoom,
                    panY: panY - e.deltaY / zoom,
                }))
            }
        }

        el.addEventListener('wheel', onWheel, { passive: false })
        return () => el.removeEventListener('wheel', onWheel)
    }, [mode])

    // Double-click to reset zoom/pan
    useEffect(() => {
        if (mode !== 'apresentacao') return
        const el = outerAreaRef.current
        if (!el) return
        const onDblClick = () => applyTransform(() => ({ zoom: 1, panX: 0, panY: 0 }))
        el.addEventListener('dblclick', onDblClick)
        return () => el.removeEventListener('dblclick', onDblClick)
    }, [mode])

    // Fullscreen toggle
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            deckRef.current?.requestFullscreen?.()
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
    const isZoomed = transform.zoom !== 1

    return (
        <div
            ref={deckRef}
            className={`presentation-deck relative mx-auto w-full bg-background flex flex-col min-h-[500px] ${isFullscreen ? 'h-screen' : 'h-[600px]'}`}
            data-fullscreen={isFullscreen}
            style={{ '--slide-content-scale': contentScale } as React.CSSProperties}
        >
            <div className="sticky top-0 z-30 h-1 w-full bg-muted shrink-0">
                <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                />
            </div>

            <div className="sticky top-1 z-20 w-full border-b bg-background/85 backdrop-blur flex items-center gap-3 px-3 h-10 shrink-0">
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate" title={title}>{title}</div>
                </div>
                <div className="flex items-center gap-2">
                    {isFullscreen && (
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => adjustContentScale(-0.1)}
                                aria-label="Diminuir conteúdo"
                            >
                                <Minus className="h-3 w-3" />
                            </Button>
                            <span className="text-xs font-mono opacity-70 tabular-nums w-10 text-center select-none">
                                {Math.round(contentScale * 100)}%
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => adjustContentScale(+0.1)}
                                aria-label="Aumentar conteúdo"
                            >
                                <Plus className="h-3 w-3" />
                            </Button>
                            <div className="w-px h-4 bg-border/60 mx-1 shrink-0" />
                        </>
                    )}
                    {isZoomed && (
                        <button
                            className="text-xs font-mono opacity-60 hover:opacity-100 transition-opacity tabular-nums"
                            onClick={() => applyTransform(() => ({ zoom: 1, panX: 0, panY: 0 }))}
                            title="Resetar zoom (ou duplo clique)"
                            aria-label="Resetar zoom"
                        >
                            {Math.round(transform.zoom * 100)}%
                        </button>
                    )}

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

            <div ref={outerAreaRef} className="flex-1 relative overflow-hidden" suppressHydrationWarning>
                <div
                    style={{
                        transform: `translate(${transform.panX}px, ${transform.panY}px) scale(${transform.zoom})`,
                        transformOrigin: 'center center',
                        width: '100%',
                        height: '100%',
                        willChange: 'transform',
                        cursor: isZoomed ? 'grab' : undefined,
                    }}
                >
                    <div ref={containerRef} className="absolute inset-0">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    )
}
