'use client'

import { useEffect, ReactNode } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CourseSidebar } from './CourseSidebar'
import { CourseDetail } from '@/lib/payload-content'
import { Heading } from '@/lib/mdx-pipeline'
import { useNav } from '@/components/layout/NavContext'

function useEqrefScroll() {
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            // Walk up from the click target to find a link
            const link = (e.target as Element).closest<Element>('a')
            if (!link) return

            // Support both plain href and xlink:href (SVG 1.1)
            const rawHref =
                link.getAttribute('href') ?? link.getAttributeNS('http://www.w3.org/1999/xlink', 'href')
            if (!rawHref) return
            // href may be a full URL (when baseURL is set) or just "#fragment"
            const hashIndex = rawHref.indexOf('#')
            if (hashIndex === -1) return
            const href = rawHref.slice(hashIndex) // normalise to "#..."
            if (!href.startsWith('#mjx-eqn')) return

            e.preventDefault()

            // MathJax URL-encodes the ID in the href (e.g. %3A for colons),
            // but the actual element id attribute is unencoded.
            const rawId = decodeURIComponent(href.slice(1))
            // getElementById handles colons in IDs; fallback to attribute selector
            const idEl =
                document.getElementById(rawId) ??
                document.querySelector<HTMLElement>(`[id="${CSS.escape(rawId)}"]`)
            if (!idEl) return

            // The id may be on an inner <g> inside the SVG; use the enclosing
            // mjx-container for correct bounding rect and highlight target.
            const target: HTMLElement =
                (idEl.closest('mjx-container') as HTMLElement | null) ?? idEl

            const rect = target.getBoundingClientRect()
            const scrollTop =
                window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2
            window.scrollTo({ top: scrollTop, behavior: 'smooth' })

            // Restart the animation (force reflow between class removal and re-add)
            target.classList.remove('eq-highlight-active')
            void target.offsetWidth
            target.classList.add('eq-highlight-active')
            target.addEventListener(
                'animationend',
                () => target.classList.remove('eq-highlight-active'),
                { once: true },
            )
        }

        document.addEventListener('click', handleClick)
        return () => document.removeEventListener('click', handleClick)
    }, [])
}

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

    useEqrefScroll()

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
