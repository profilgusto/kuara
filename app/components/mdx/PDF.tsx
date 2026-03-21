'use client'
import React from 'react'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

// react-pdf is only bundled + loaded when this component is actually rendered
const PDFViewer = dynamic(() => import('./PDFViewer'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center gap-3 min-h-[55vh] rounded-lg border border-border bg-card text-muted-foreground">
            <Loader2 size={22} className="animate-spin text-primary" />
            <span className="text-sm">Carregando visualizador…</span>
        </div>
    ),
})

type Props = {
    src?: string
    url?: string
    title?: string
    className?: string
    style?: React.CSSProperties
}

export default function PDF({ src, url: urlProp, title, className, style }: Props) {
    const url =
        typeof urlProp === 'string' ? urlProp : typeof src === 'string' ? src : ''

    // Parse width controls from title: wsm=N wlg=N or size=SM,LG
    let wsm: number | undefined
    let wlg: number | undefined
    if (typeof title === 'string' && title) {
        const mSm = title.match(/(?:^|\s)wsm=(\d{1,3})(?=\s|$)/i)
        const mLg = title.match(/(?:^|\s)wlg=(\d{1,3})(?=\s|$)/i)
        if (mSm) wsm = Math.max(0, Math.min(100, parseInt(mSm[1], 10)))
        if (mLg) wlg = Math.max(0, Math.min(100, parseInt(mLg[1], 10)))
        if (!mSm || !mLg) {
            const altFmt = title.match(/(?:^|\s)size=(\d{1,3})\s*,\s*(\d{1,3})(?=\s|$)/i)
            if (altFmt) {
                wsm = wsm ?? Math.max(0, Math.min(100, parseInt(altFmt[1], 10)))
                wlg = wlg ?? Math.max(0, Math.min(100, parseInt(altFmt[2], 10)))
            }
        }
    }

    // Strip width flags from the title before passing it as the download filename
    const cleanTitle = title
        ?.replace(/(?:^|\s)(?:wsm|wlg)=\d{1,3}(?=\s|$)/gi, '')
        .replace(/(?:^|\s)size=\d{1,3}\s*,\s*\d{1,3}(?=\s|$)/gi, '')
        .trim()

    const styleVars: React.CSSProperties = { ...style }
    if (typeof wsm === 'number') (styleVars as Record<string, string>)['--mdx-pdf-wsm'] = `${wsm}vw`
    if (typeof wlg === 'number') (styleVars as Record<string, string>)['--mdx-pdf-wlg'] = `${wlg}vw`

    return (
        <div
            className={['mdx-pdf-container block mx-auto my-8', className]
                .filter(Boolean)
                .join(' ')}
            style={styleVars}
        >
            <PDFViewer url={url} title={cleanTitle || undefined} />
        </div>
    )
}
