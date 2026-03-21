'use client'

import { useState, useEffect, ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { PanelRightOpen, PanelRightClose, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
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
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => { setMounted(true) }, [])

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
                <nav className="flex items-center gap-2 px-3 py-2 rounded-xl bg-background/60 backdrop-blur border border-border/40 text-sm text-muted-foreground shadow-lg">
                    {/* Kuara logo */}
                    <Link
                        href="/disciplinas"
                        className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors shrink-0"
                    >
                        <Image src="/icon.svg" alt="Kuara logo" width={32} height={32} />
                        <span className="font-serif font-semibold text-base">Kuara</span>
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

                    {/* Right side: theme toggle + sidebar toggle */}
                    <div className="ml-auto flex items-center gap-1 shrink-0">
                        {mounted && (
                            <button
                                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                aria-label="Alternar tema"
                                className="flex items-center justify-center h-6 w-6 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            >
                                {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                            </button>
                        )}
                        <button
                            onClick={() => setSidebarOpen((v) => !v)}
                            aria-label={sidebarOpen ? 'Ocultar menu' : 'Mostrar menu'}
                            className="flex items-center justify-center h-6 w-6 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        >
                            {sidebarOpen ? (
                                <PanelRightClose className="h-4 w-4" />
                            ) : (
                                <PanelRightOpen className="h-4 w-4" />
                            )}
                        </button>
                    </div>
                </nav>
            </div>

            {/* Body */}
            <div className="flex flex-row flex-1">
                {/* Backdrop */}
                <div
                    className={`fixed inset-0 z-40 transition-opacity duration-300 ${sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                    onClick={() => setSidebarOpen(false)}
                >
                    <div className="absolute inset-0" />
                </div>

                {/* Sidebar panel — same style as header, floats over content */}
                <aside
                    className={`fixed top-[4.5rem] right-3 bottom-3 z-50 w-72 rounded-xl bg-background/60 backdrop-blur border border-border/40 shadow-lg transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : 'translate-x-[calc(100%+12px)]'}`}
                >
                    <ScrollArea className="h-full">
                        {sidebarContent(() => setSidebarOpen(false))}
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
