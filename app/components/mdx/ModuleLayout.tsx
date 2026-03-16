'use client'

import { useState, ReactNode } from 'react'
import Link from 'next/link'
import { PanelLeftOpen, PanelLeftClose, Leaf } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CourseSidebar } from './CourseSidebar'
import { CourseDetail } from '@/lib/payload-content'
import { Heading } from '@/lib/mdx-pipeline'

interface ModuleLayoutProps {
    course: CourseDetail
    currentModuleSlug: string
    headings: Heading[]
    courseTitle: string
    courseSlug: string
    moduleTitle: string
    children: ReactNode
}

export function ModuleLayout({
    course,
    currentModuleSlug,
    headings,
    courseTitle,
    courseSlug,
    moduleTitle,
    children,
}: ModuleLayoutProps) {
    const [desktopOpen, setDesktopOpen] = useState(true)
    const [mobileOpen, setMobileOpen] = useState(false)

    const sidebarContent = (onLinkClick?: () => void) => (
        <CourseSidebar
            course={course}
            currentModuleSlug={currentModuleSlug}
            headings={headings}
            onLinkClick={onLinkClick}
        />
    )

    return (
        <div className="flex flex-col min-h-[calc(100vh-4rem)]">
            {/* Sticky top header bar */}
            <div className="sticky top-0 z-30 px-3 pt-3 pb-2">
                <nav className="flex items-center gap-2 px-3 py-2 rounded-xl bg-background/70 backdrop-blur-md border border-border/40 text-sm text-muted-foreground shadow-sm">
                    {/* Mobile toggle */}
                    <button
                        onClick={() => setMobileOpen((v) => !v)}
                        aria-label={mobileOpen ? 'Ocultar menu' : 'Mostrar menu'}
                        className="flex md:hidden items-center justify-center h-6 w-6 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
                    >
                        {mobileOpen ? (
                            <PanelLeftClose className="h-4 w-4" />
                        ) : (
                            <PanelLeftOpen className="h-4 w-4" />
                        )}
                    </button>
                    {/* Desktop toggle */}
                    <button
                        onClick={() => setDesktopOpen((v) => !v)}
                        aria-label={desktopOpen ? 'Ocultar sidebar' : 'Mostrar sidebar'}
                        className="hidden md:flex items-center justify-center h-6 w-6 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
                    >
                        {desktopOpen ? (
                            <PanelLeftClose className="h-4 w-4" />
                        ) : (
                            <PanelLeftOpen className="h-4 w-4" />
                        )}
                    </button>

                    {/* Kuara logo */}
                    <Link
                        href="/disciplinas"
                        className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors shrink-0"
                    >
                        <Leaf className="h-3.5 w-3.5 text-primary" />
                        <span className="font-serif font-semibold text-sm">Kuara</span>
                    </Link>

                    <span className="text-border shrink-0">/</span>

                    {/* Breadcrumb */}
                    <Link
                        href={`/disciplinas/${courseSlug}`}
                        className="hover:underline truncate max-w-[120px] sm:max-w-xs shrink-0"
                    >
                        {courseTitle}
                    </Link>
                    <span className="shrink-0">/</span>
                    <span className="text-foreground font-medium truncate">{moduleTitle}</span>
                </nav>
            </div>

            {/* Body: sidebar + content */}
            <div className="flex flex-row flex-1">
                {/* Mobile overlay sidebar */}
                {mobileOpen && (
                    <div
                        className="fixed inset-0 z-40 md:hidden"
                        onClick={() => setMobileOpen(false)}
                    >
                        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
                        <aside
                            className="absolute top-0 left-0 h-full w-72 border-r bg-background shadow-xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <ScrollArea className="h-full">
                                {sidebarContent(() => setMobileOpen(false))}
                            </ScrollArea>
                        </aside>
                    </div>
                )}

                {/* Desktop sidebar (in-flow, pushes content) */}
                <aside
                    className={`hidden md:block border-r bg-muted/20 shrink-0 sticky top-[3.25rem] self-start h-[calc(100vh-3.25rem)] transition-all duration-300 ease-in-out overflow-hidden ${
                        desktopOpen ? 'w-72' : 'w-0 border-r-0'
                    }`}
                >
                    <ScrollArea className="h-full">
                        {sidebarContent()}
                    </ScrollArea>
                </aside>

                {/* Main content */}
                <main className="flex-1 w-full min-w-0">
                    <div className="container max-w-4xl mx-auto px-4 py-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
