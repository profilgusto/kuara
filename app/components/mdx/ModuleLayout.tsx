'use client'

import { useEffect, ReactNode } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CourseSidebar } from './CourseSidebar'
import { CourseDetail } from '@/lib/payload-content'
import { Heading } from '@/lib/mdx-pipeline'
import { useNav } from '@/components/layout/NavContext'

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
    const { sidebarOpen, setSidebarOpen, setHasSidebar, setBreadcrumbs } = useNav()

    useEffect(() => {
        setBreadcrumbs([
            { label: courseTitle, href: `/disciplinas/${courseSlug}` },
            { label: moduleTitle },
        ])
        setHasSidebar(true)
        return () => {
            setBreadcrumbs([])
            setHasSidebar(false)
            setSidebarOpen(false)
        }
    // state setters from useState are stable — safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseTitle, courseSlug, moduleTitle])

    return (
        <div className="flex flex-col">
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-40 transition-opacity duration-300 ${sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setSidebarOpen(false)}
            >
                <div className="absolute inset-0" />
            </div>

            {/* Sidebar panel — floats below root SiteNav */}
            <aside
                className={`fixed top-[4.5rem] right-3 bottom-3 z-50 w-72 rounded-xl bg-background/60 backdrop-blur border border-border/40 shadow-lg transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : 'translate-x-[calc(100%+12px)]'}`}
            >
                <ScrollArea className="h-full">
                    <CourseSidebar
                        course={course}
                        currentModuleSlug={currentModuleSlug}
                        headings={headings}
                        onLinkClick={() => setSidebarOpen(false)}
                    />
                </ScrollArea>
            </aside>

            {/* Main content */}
            <main className="flex-1 w-full min-w-0">
                <div className="container max-w-4xl mx-auto px-4 py-8">
                    {children}
                </div>
            </main>
        </div>
    )
}
