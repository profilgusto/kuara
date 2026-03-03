'use client'
import React from 'react'

type Props = {
    src?: string
    title?: string
    className?: string
    style?: React.CSSProperties
}

export default function PDF({ src, title, className, style }: Props) {
    const url = typeof src === 'string' ? src : ''
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

    const styleVars: React.CSSProperties = { ...style }
    if (typeof wsm === 'number') (styleVars as any)['--mdx-pdf-wsm'] = `${wsm}vw`
    if (typeof wlg === 'number') (styleVars as any)['--mdx-pdf-wlg'] = `${wlg}vw`

    return (
        <div className={['mdx-pdf-container block mx-auto my-8', className].filter(Boolean).join(' ')} style={styleVars}>
            <div className="relative border rounded-lg overflow-hidden bg-secondary/30">
                <iframe
                    src={url}
                    className="mdx-pdf-frame block w-full min-h-[60vh] bg-background"
                />
            </div>
        </div>
    )
}
