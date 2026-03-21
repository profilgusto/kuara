'use client'

import { useState, useEffect, Fragment } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Sun, Moon, PanelRightOpen, PanelRightClose } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useNav } from './NavContext'

export function SiteNav() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    const { breadcrumbs, sidebarOpen, setSidebarOpen, hasSidebar } = useNav()
    useEffect(() => { setMounted(true) }, [])

    return (
        <div className="sticky top-0 z-30 px-3 pt-3 pb-2">
            <nav className="flex items-center gap-2 px-3 py-2 rounded-xl bg-background/60 backdrop-blur border border-border/40 text-sm text-muted-foreground shadow-lg">
                <Link
                    href="/disciplinas"
                    className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors shrink-0"
                >
                    <Image src="/icon.svg" alt="Kuara logo" width={32} height={32} />
                    <span className="font-serif font-semibold text-base">Kuara</span>
                </Link>

                {breadcrumbs.map((crumb, i) => (
                    <Fragment key={i}>
                        <span className="text-border shrink-0">/</span>
                        {crumb.href ? (
                            <Link
                                href={crumb.href}
                                className="hover:underline truncate max-w-[120px] sm:max-w-xs shrink-0"
                            >
                                {crumb.label}
                            </Link>
                        ) : (
                            <span className="text-foreground font-medium truncate">{crumb.label}</span>
                        )}
                    </Fragment>
                ))}

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
                    {hasSidebar && (
                        <button
                            onClick={() => setSidebarOpen(v => !v)}
                            aria-label={sidebarOpen ? 'Ocultar menu' : 'Mostrar menu'}
                            className="flex items-center justify-center h-6 w-6 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        >
                            {sidebarOpen
                                ? <PanelRightClose className="h-4 w-4" />
                                : <PanelRightOpen className="h-4 w-4" />
                            }
                        </button>
                    )}
                </div>
            </nav>
        </div>
    )
}
