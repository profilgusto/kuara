'use client'

import React, { ReactNode, isValidElement } from 'react'
import { useViewMode } from './useViewMode'

export default function SlideLayout({ children }: { children: ReactNode }) {
    const mode = useViewMode()

    if (mode !== 'apresentacao') {
        return <>{children}</>
    }

    let secondColumnContent: ReactNode = null
    let secondColumnWidth = '50%'
    const mainColumnContent: ReactNode[] = []

    React.Children.forEach(children, (child) => {
        if (!isValidElement(child)) {
            mainColumnContent.push(child)
            return
        }

        let isSecondColumn = false
        if (typeof child.type === 'function' && (child.type as { name?: string }).name === 'SlideSecondColumnContent') {
            isSecondColumn = true
        }

        if (isSecondColumn) {
            const props = (child as React.ReactElement<{ width?: string, children?: React.ReactNode }>).props
            secondColumnContent = props.children
            if (props.width) {
                secondColumnWidth = props.width
            }
        } else {
            mainColumnContent.push(child)
        }
    })

    if (secondColumnContent) {
        return (
            <div className="slide-layout-horizontal h-full flex flex-col">
                <div className="flex-1 flex flex-row gap-6 lg:gap-8 items-start min-h-0">
                    <div
                        className="slide-main-content space-y-4 overflow-y-auto pr-2"
                        style={{ flex: `0 0 calc(100% - ${secondColumnWidth} - 1.5rem)` }}
                    >
                        {mainColumnContent}
                    </div>
                    <div
                        className="slide-second-col-content space-y-4 overflow-y-auto"
                        style={{ flex: `0 0 ${secondColumnWidth}` }}
                    >
                        {secondColumnContent}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="slide-layout-vertical space-y-4">
            {mainColumnContent}
        </div>
    )
}
