'use client'
import React from 'react'
import { useViewMode } from './useViewMode'

interface KImageProps {
    url?: string
    src?: string
    alt?: string
    width?: string | number
    widthPresentation?: string | number
    // We keep height on the interface so existing MDX won't throw TS errors if they pass it,
    // but we ignore it to force aspect ratio.
    height?: string | number
    heightPresentation?: string | number
    align?: 'left' | 'center' | 'right'
    className?: string
}

export default function KImage({
    url,
    src,
    alt = '',
    width,
    widthPresentation,
    align = 'center',
    className
}: KImageProps) {
    const mode = useViewMode()
    const imageSrc = url || src

    if (!imageSrc) return null

    const alignmentStyles = {
        left: 'justify-start',
        center: 'justify-center',
        right: 'justify-end'
    }

    // Determine the active width based on the view mode
    const activeWidth = mode === 'apresentacao' && widthPresentation !== undefined ? widthPresentation : width

    return (
        <div className={`my-8 flex w-full ${alignmentStyles[align]} ${className || ''}`}>
            <img
                src={imageSrc}
                alt={alt}
                width={activeWidth}
                className="rounded-lg shadow-md h-auto transition-all duration-300"
                style={{
                    width: activeWidth ? (typeof activeWidth === 'number' ? `${activeWidth}px` : activeWidth) : 'auto',
                    height: 'auto',
                }}
            />
        </div>
    )
}
