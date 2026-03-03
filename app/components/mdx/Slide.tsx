'use client'
import { ReactNode } from 'react'
import { useViewMode } from './useViewMode'
import SlideLayout from './SlideLayouts'

export default function Slide({
    children,
    className,
    ...rest
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
    const mode = useViewMode()
    const isPresentation = mode === 'apresentacao'
    const layout = (rest as any)['data-layout'] || '1'

    return (
        <section
            {...rest}
            className={[
                isPresentation && 'relative mx-auto my-2 max-w-4xl px-6 py-6 rounded-2xl shadow-sm bg-[var(--bg)] text-[var(--fg)]',
                className,
            ].filter(Boolean).join(' ')}
        >
            <SlideLayout layout={layout}>
                {children}
            </SlideLayout>
        </section>
    )
}
