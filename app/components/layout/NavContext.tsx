'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface Breadcrumb {
    label: string
    href?: string
}

interface NavContextValue {
    breadcrumbs: Breadcrumb[]
    setBreadcrumbs: (items: Breadcrumb[]) => void
    sidebarOpen: boolean
    setSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void
    hasSidebar: boolean
    setHasSidebar: (has: boolean) => void
}

const NavContext = createContext<NavContextValue | null>(null)

export function NavProvider({ children }: { children: ReactNode }) {
    const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([])
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [hasSidebar, setHasSidebar] = useState(false)

    return (
        <NavContext.Provider value={{ breadcrumbs, setBreadcrumbs, sidebarOpen, setSidebarOpen, hasSidebar, setHasSidebar }}>
            {children}
        </NavContext.Provider>
    )
}

export function useNav() {
    const ctx = useContext(NavContext)
    if (!ctx) throw new Error('useNav must be used within NavProvider')
    return ctx
}

/** Drop this into any page (server or client) to set the nav breadcrumbs. */
export function SetNavBreadcrumb({ items }: { items: Breadcrumb[] }) {
    const { setBreadcrumbs } = useNav()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        setBreadcrumbs(items)
        return () => setBreadcrumbs([])
    }, [JSON.stringify(items)])
    return null
}
