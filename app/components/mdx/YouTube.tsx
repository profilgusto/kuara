'use client'
import React from 'react'

export interface YouTubeProps {
    url?: string
    id?: string
    title?: string
    start?: number
    className?: string
}

function extractId(input: string | undefined): string | null {
    if (!input) return null
    const raw = input.trim()
    if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw
    try {
        const u = new URL(raw)
        if (/youtu\.be$/i.test(u.hostname)) {
            const id = u.pathname.replace(/^\//, '').split(/[/?#]/)[0]
            if (id) return id
        }
        if (/youtube\.com$/i.test(u.hostname)) {
            if (u.pathname === '/watch') {
                const v = u.searchParams.get('v')
                if (v) return v
            }
            if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] || null
            if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null
        }
    } catch { }
    return null
}

export default function YouTube({ url, id, title, start, className }: YouTubeProps) {
    const vid = extractId(id || url)
    if (!vid) {
        return (
            <div className="my-6 p-4 rounded-md border text-sm text-destructive bg-destructive/5">
                YouTube: vídeo inválido
            </div>
        )
    }
    const params = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' })
    if (start && Number.isFinite(start) && start > 0) params.set('start', String(start))
    const src = `https://www.youtube.com/embed/${vid}?${params.toString()}`
    return (
        <div className={['my-8 mx-auto w-full max-w-4xl aspect-video relative', className].filter(Boolean).join(' ')}>
            <iframe
                src={src}
                title={title || 'YouTube video'}
                className="absolute inset-0 w-full h-full rounded-lg shadow-sm"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
            />
        </div>
    )
}
