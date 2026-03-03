'use client'

import React, { ReactNode } from 'react'
import { useViewMode } from './useViewMode'

interface SlideLayoutProps {
    children: ReactNode
    layout?: string
}

// Helper to split children into title, text, and image groups
function splitContentByType(children: ReactNode) {
    const childArray = React.Children.toArray(children)
    const titleContent: ReactNode[] = []
    const textContent: ReactNode[] = []
    const imageContent: ReactNode[] = []

    function containsImages(element: any): boolean {
        if (!React.isValidElement(element)) return false
        const isDirectImage =
            element.type === 'img' ||
            element.type === 'figure' ||
            (element.props && ((element.props as any).src || (element.props as any).alt))
        if (isDirectImage) return true
        if (element.props && (element.props as any).children) {
            return React.Children.toArray((element.props as any).children).some(containsImages)
        }
        return false
    }

    childArray.forEach((child) => {
        if (React.isValidElement(child)) {
            const isTitle =
                child.type === 'h1' || child.type === 'h2' || child.type === 'h3' ||
                child.type === 'h4' || child.type === 'h5' || child.type === 'h6'

            if (isTitle) {
                titleContent.push(child)
            } else if (containsImages(child)) {
                imageContent.push(child)
            } else {
                textContent.push(child)
            }
        } else {
            textContent.push(child)
        }
    })

    return { titleContent, textContent, imageContent }
}

// Layout 1: Traditional vertical layout (default)
function VerticalLayout({ children }: { children: ReactNode }) {
    const { titleContent, textContent, imageContent } = splitContentByType(children)
    return (
        <div className="slide-layout-vertical">
            {titleContent.length > 0 && (
                <div className="slide-title-section mb-4">{titleContent}</div>
            )}
            <div className="slide-content-section space-y-4">
                {textContent}
                {imageContent}
            </div>
        </div>
    )
}

// Layout 2: Horizontal split (text left, images right)
function HorizontalLayout({ children }: { children: ReactNode }) {
    const { titleContent, textContent, imageContent } = splitContentByType(children)
    return (
        <div className="slide-layout-horizontal">
            {titleContent.length > 0 && (
                <div className="slide-title-section mb-4">{titleContent}</div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start max-h-[75vh] overflow-hidden">
                <div className="slide-text-content space-y-4 overflow-y-auto pr-2 max-h-[70vh]">
                    {textContent.length > 0 ? textContent : (
                        <div className="text-center text-muted-foreground italic">[Conteúdo de texto]</div>
                    )}
                </div>
                <div className="slide-image-content flex flex-col justify-center space-y-4 max-h-[70vh] overflow-hidden">
                    {imageContent.length > 0 ? imageContent : (
                        <div className="text-center text-muted-foreground italic border-2 border-dashed rounded-lg p-8">
                            [Imagens]
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// Main layout selector
export default function SlideLayout({ children, layout = '1' }: SlideLayoutProps) {
    const mode = useViewMode()

    // Only apply special layouts in presentation mode
    if (mode !== 'apresentacao') {
        return <>{children}</>
    }

    switch (layout) {
        case '2':
            return <HorizontalLayout>{children}</HorizontalLayout>
        case '1':
        default:
            return <VerticalLayout>{children}</VerticalLayout>
    }
}
