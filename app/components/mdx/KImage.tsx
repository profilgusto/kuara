'use client'
import React from 'react'
import { useViewMode } from './useViewMode'

interface KImageProps {
    url?: string
    src?: string
    alt?: string
    width?: string | number
    height?: string | number
    widthPresentation?: string | number
    heightPresentation?: string | number
    align?: 'left' | 'center' | 'right'
    className?: string
}

export default function KImage({
    url,
    src,
    alt = '',
    width,
    height,
    widthPresentation,
    heightPresentation,
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

    // Determine the active width and height based on the view mode
    const activeWidth = mode === 'apresentacao' && widthPresentation !== undefined ? widthPresentation : width
    const activeHeight = mode === 'apresentacao' && heightPresentation !== undefined ? heightPresentation : height

    return (
        <div className={`my-8 flex w-full ${alignmentStyles[align]} ${className || ''}`}>
            <img
                src={imageSrc}
                alt={alt}
                width={activeWidth}
                height={activeHeight}
                className="rounded-lg shadow-md h-auto transition-all duration-300"
                style={{
                    width: activeWidth ? (typeof activeWidth === 'number' ? `${activeWidth}px` : activeWidth) : 'auto',
                    height: activeHeight ? (typeof activeHeight === 'number' ? `${activeHeight}px` : activeHeight) : 'auto',
                }}
            />
        </div>
    )
}
