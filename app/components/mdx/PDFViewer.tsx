'use client'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { ZoomIn, ZoomOut, Download, Loader2, FileWarning } from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

const ZOOM_STEP = 0.25
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3.0
const ZOOM_TRANSITION_MS = 220

const btnBase =
    'flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-sm ' +
    'text-muted-foreground transition-colors duration-200 ' +
    'hover:text-primary hover:bg-primary/10 ' +
    'disabled:opacity-30 disabled:pointer-events-none ' +
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

type Props = {
    url: string
    title?: string
}

export default function PDFViewer({ url, title }: Props) {
    const [numPages, setNumPages] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)

    // visualScale — updates immediately → CSS transition fires (smooth)
    // renderScale — debounced → react-pdf re-renders canvas at crisp resolution
    const [visualScale, setVisualScale] = useState(1.0)
    const [renderScale, setRenderScale] = useState(1.0)

    const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined)

    const viewportRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const isDragging = useRef(false)
    const lastPos = useRef({ x: 0, y: 0 })
    const zoomDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
    // One ref per page div, used by IntersectionObserver to track current page
    const pageRefs = useRef<(HTMLDivElement | null)[]>([])

    useEffect(() => {
        if (!containerRef.current) return
        const ro = new ResizeObserver((entries) => {
            setContainerWidth(entries[0].contentRect.width)
        })
        ro.observe(containerRef.current)
        return () => ro.disconnect()
    }, [])

    // Track the most-visible page as the user scrolls
    useEffect(() => {
        if (!viewportRef.current || numPages === 0) return
        const ratios = new Array<number>(numPages).fill(0)
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const idx = pageRefs.current.indexOf(entry.target as HTMLDivElement)
                    if (idx !== -1) ratios[idx] = entry.intersectionRatio
                })
                const best = ratios.indexOf(Math.max(...ratios))
                if (best !== -1) setCurrentPage(best + 1)
            },
            { root: viewportRef.current, threshold: Array.from({ length: 11 }, (_, i) => i / 10) },
        )
        pageRefs.current.forEach((el) => el && io.observe(el))
        return () => io.disconnect()
    }, [numPages])

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages)
    }

    const applyZoom = (newScale: number) => {
        setVisualScale(newScale)
        if (zoomDebounce.current) clearTimeout(zoomDebounce.current)
        zoomDebounce.current = setTimeout(() => setRenderScale(newScale), ZOOM_TRANSITION_MS)
    }

    const zoomIn = () => applyZoom(Math.min(MAX_ZOOM, +(visualScale + ZOOM_STEP).toFixed(2)))
    const zoomOut = () => applyZoom(Math.max(MIN_ZOOM, +(visualScale - ZOOM_STEP).toFixed(2)))

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        isDragging.current = true
        lastPos.current = { x: e.clientX, y: e.clientY }
        e.preventDefault()
    }, [])

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging.current || !viewportRef.current) return
        const dx = e.clientX - lastPos.current.x
        const dy = e.clientY - lastPos.current.y
        viewportRef.current.scrollLeft -= dx
        viewportRef.current.scrollTop -= dy
        lastPos.current = { x: e.clientX, y: e.clientY }
    }, [])

    const stopDrag = useCallback(() => { isDragging.current = false }, [])

    const pageWidth = containerWidth ? Math.round(containerWidth * renderScale) : undefined
    const cssScale = renderScale > 0 ? visualScale / renderScale : 1
    const filename = title ?? url.split('/').pop() ?? 'document.pdf'

    return (
        <div ref={containerRef} className="flex flex-col rounded-lg border border-border overflow-hidden">

            {/* ── Toolbar ─────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-card border-b border-border shrink-0">

                <span className="font-mono text-xs text-muted-foreground select-none">
                    {numPages ? `${currentPage} / ${numPages}` : '—'}
                </span>

                {/* Zoom */}
                <div className="flex items-center gap-0.5">
                    <button onClick={zoomOut} disabled={visualScale <= MIN_ZOOM} className={btnBase} aria-label="Reduzir zoom">
                        <ZoomOut size={16} />
                    </button>
                    <span className="font-mono text-xs text-muted-foreground w-[4.5ch] text-center select-none">
                        {Math.round(visualScale * 100)}%
                    </span>
                    <button onClick={zoomIn} disabled={visualScale >= MAX_ZOOM} className={btnBase} aria-label="Aumentar zoom">
                        <ZoomIn size={16} />
                    </button>
                </div>

                {/* Download — icon only */}
                <a href={url} download={filename} className={btnBase} aria-label="Baixar PDF">
                    <Download size={16} />
                </a>
            </div>

            {/* ── Viewport — continuous scroll ─────────────────── */}
            <div
                ref={viewportRef}
                className="overflow-auto bg-muted/20 select-none cursor-grab active:cursor-grabbing"
                style={{ minHeight: '55vh', maxHeight: '80vh' }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={stopDrag}
                onMouseLeave={stopDrag}
            >
                <div className="flex flex-col items-center py-6 px-4 gap-4">
                    <Document
                        file={url}
                        onLoadSuccess={onDocumentLoadSuccess}
                        loading={
                            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                                <Loader2 size={28} className="animate-spin text-primary" />
                                <span className="text-sm">Carregando PDF…</span>
                            </div>
                        }
                        error={
                            <div className="flex flex-col items-center gap-3 py-16 text-destructive">
                                <FileWarning size={28} />
                                <span className="text-sm">Não foi possível carregar o PDF.</span>
                            </div>
                        }
                    >
                        {Array.from({ length: numPages }, (_, i) => (
                            <div
                                key={i}
                                ref={(el) => { pageRefs.current[i] = el }}
                                style={{
                                    transform: `scale(${cssScale})`,
                                    transformOrigin: 'top center',
                                    transition: `transform ${ZOOM_TRANSITION_MS}ms ease-in-out`,
                                }}
                            >
                                <Page
                                    pageNumber={i + 1}
                                    width={pageWidth}
                                    renderTextLayer
                                    renderAnnotationLayer
                                    className="shadow-xl"
                                />
                            </div>
                        ))}
                    </Document>
                </div>
            </div>
        </div>
    )
}
