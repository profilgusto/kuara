'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CourseDetail, CourseModule } from '@/lib/payload-content'
import { Heading } from '@/lib/mdx-pipeline'
import { BookOpen, FlaskConical, ClipboardCheck, FileText } from 'lucide-react'

interface CourseSidebarProps {
    course: CourseDetail
    currentModuleSlug?: string
    headings?: Heading[]
    onLinkClick?: () => void
}

const typeConfig: Record<string, { label: string; icon: typeof BookOpen; color: string }> = {
    'modulo-teorico': { label: 'Módulos Teóricos', icon: BookOpen, color: 'text-blue-500' },
    'modulo-pratico': { label: 'Módulos Práticos', icon: FlaskConical, color: 'text-emerald-500' },
    'atividade-avaliativa': { label: 'Atividades', icon: ClipboardCheck, color: 'text-amber-500' },
    'recurso': { label: 'Recursos', icon: FileText, color: 'text-purple-500' },
}

export function CourseSidebar({ course, currentModuleSlug, headings = [], onLinkClick }: CourseSidebarProps) {
    const pathname = usePathname()
    const [activeHeading, setActiveHeading] = useState<string | null>(null)

    // Scroll spy for headings
    useEffect(() => {
        if (headings.length === 0) return

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setActiveHeading(entry.target.id)
                    }
                })
            },
            { rootMargin: '-20% 0px -80% 0px' }
        )

        headings.forEach((h) => {
            const el = document.getElementById(h.id)
            if (el) observer.observe(el)
        })

        return () => observer.disconnect()
    }, [headings])

    // Group modules
    const grouped = course.modules.reduce((acc, mod) => {
        if (!acc[mod.type]) acc[mod.type] = []
        acc[mod.type].push(mod)
        return acc
    }, {} as Record<string, CourseModule[]>)

    const typeOrder = ['modulo-teorico', 'modulo-pratico', 'atividade-avaliativa', 'recurso']

    return (
        <nav className="p-4 space-y-6 text-sm overflow-y-auto overscroll-contain h-full">
            <div className="mb-2">
                <Link
                    href={`/disciplinas/${course.slug}`}
                    className="text-base font-semibold leading-snug tracking-tight hover:underline flex flex-col gap-1"
                >
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        {course.code}
                    </span>
                    {course.title}
                </Link>
            </div>

            {typeOrder.map((type) => {
                const mods = grouped[type]
                if (!mods?.length) return null
                const cfg = typeConfig[type]
                const Icon = cfg.icon

                return (
                    <div key={type} className="space-y-2">
                        <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground/70 flex items-center gap-1.5 mb-2">
                            <Icon className="h-3.5 w-3.5" />
                            {cfg.label}
                        </div>

                        <div className="space-y-1">
                            {mods.map((m) => {
                                const href = `/disciplinas/${course.slug}/${m.slug}`
                                const isActive = pathname === href
                                const isCurrentModule = currentModuleSlug === m.slug

                                return (
                                    <div key={m.id}>
                                        <Link
                                            href={href}
                                            onClick={onLinkClick}
                                            className={`block py-1 transition-colors hover:text-primary ${isActive ? 'font-medium text-primary' : 'text-muted-foreground'
                                                }`}
                                        >
                                            {m.number ? `${m.number}. ` : ''}{m.title}
                                        </Link>

                                        {/* Show headings if this is the currently active module */}
                                        {isCurrentModule && headings.length > 0 && (
                                            <ul className="ml-4 mt-2 mb-2 space-y-2 border-l-2 border-muted pl-3 text-[13px]">
                                                {headings.map((h) => {
                                                    const isHeadingActive = activeHeading === h.id
                                                    return (
                                                        <li key={h.id}>
                                                            <a
                                                                href={`#${h.id}`}
                                                                className={`block transition-colors line-clamp-2 ${isHeadingActive
                                                                        ? 'font-medium text-primary'
                                                                        : 'text-muted-foreground hover:text-foreground'
                                                                    }`}
                                                                onClick={(e) => {
                                                                    e.preventDefault()
                                                                    document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' })
                                                                    history.pushState(null, '', `#${h.id}`)
                                                                    onLinkClick?.()
                                                                }}
                                                            >
                                                                {h.text}
                                                            </a>
                                                        </li>
                                                    )
                                                })}
                                            </ul>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            })}
        </nav>
    )
}
