import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCourse, getModule } from '@/lib/payload-content'
import { compileMdx, extractHeadings } from '@/lib/mdx-pipeline'
import { getMdxComponents } from '@/lib/mdx-components'
import { CourseSidebar } from '@/components/mdx/CourseSidebar'
import { ModulePageClient } from '@/components/mdx/ModulePageClient'
import { ScrollArea } from '@/components/ui/scroll-area'

export const dynamic = 'force-dynamic'

export default async function ModulePage({
    params,
}: {
    params: Promise<{ slug: string; mod: string }>
}) {
    const { slug, mod } = await params

    // Need both the full course (for the sidebar) and the specific module
    const [course, result] = await Promise.all([
        getCourse(slug),
        getModule(slug, mod)
    ])

    if (!course || !result) notFound()

    const { module: moduleData, courseTitle, courseSlug } = result

    // Extract headings from raw MDX before compiling
    const headings = moduleData.content ? extractHeadings(moduleData.content) : []

    // Compile MDX content
    let content = null
    if (moduleData.content) {
        const compiled = await compileMdx(moduleData.content, getMdxComponents())
        content = compiled.content
    }

    return (
        <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">
            {/* Sidebar (Desktop only for now, can be put in a Sheet for mobile later) */}
            <aside className="hidden md:block w-72 border-r bg-muted/20 shrink-0">
                <ScrollArea className="h-[calc(100vh-4rem)] sticky top-16">
                    <CourseSidebar
                        course={course}
                        currentModuleSlug={moduleData.slug}
                        headings={headings}
                    />
                </ScrollArea>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 w-full min-w-0">
                <div className="container max-w-4xl mx-auto px-4 py-8">
                    {/* Breadcrumb */}
                    <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                        <Link href="/disciplinas" className="hover:underline">Disciplinas</Link>
                        <span>/</span>
                        <Link href={`/disciplinas/${courseSlug}`} className="hover:underline truncate max-w-[150px] sm:max-w-xs">{courseTitle}</Link>
                        <span>/</span>
                        <span className="text-foreground font-medium truncate">{moduleData.title}</span>
                    </nav>

                    {/* Client Wrapper (Handles ViewMode & SlideDeck) */}
                    <ModulePageClient title={moduleData.title}>
                        {/* MDX content */}
                        {content ? (
                            <article className="prose prose-neutral dark:prose-invert max-w-none">
                                {content}
                            </article>
                        ) : (
                            <div className="text-center py-12 border border-dashed rounded-xl">
                                <p className="text-muted-foreground">Este módulo ainda não possui conteúdo.</p>
                            </div>
                        )}
                    </ModulePageClient>
                </div>
            </main>
        </div>
    )
}

