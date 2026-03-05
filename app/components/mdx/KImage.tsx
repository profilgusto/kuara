'use client'
import React from 'react'

interface KImageProps {
    url?: string
    src?: string
    alt?: string
    width?: string | number
    height?: string | number
    align?: 'left' | 'center' | 'right'
    className?: string
}

export default function KImage({
    url,
    src,
    alt = '',
    width,
    height,
    align = 'center',
    className
}: KImageProps) {
    const imageSrc = url || src

    if (!imageSrc) return null

    const alignmentStyles = {
        left: 'justify-start',
        center: 'justify-center',
        right: 'justify-end'
    }

    return (
        <div className={`my-8 flex w-full ${alignmentStyles[align]} ${className || ''}`}>
            <img
                src={imageSrc}
                alt={alt}
                width={width}
                height={height}
                className="rounded-lg shadow-md h-auto"
                style={{
                    width: width ? (typeof width === 'number' ? `${width}px` : width) : 'auto',
                    height: height ? (typeof height === 'number' ? `${height}px` : height) : 'auto',
                }}
            />
        </div>
    )
}
