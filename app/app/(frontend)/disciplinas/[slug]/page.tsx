import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCourse, type CourseModule, type ModuleType } from '@/lib/payload-content'
import { BookOpen, FlaskConical, ClipboardCheck, FileText } from 'lucide-react'

export const dynamic = 'force-dynamic'

const typeConfig: Record<ModuleType, { label: string; icon: typeof BookOpen; color: string }> = {
    'modulo-teorico': { label: 'Módulos Teóricos', icon: BookOpen, color: 'text-blue-600 dark:text-blue-400' },
    'modulo-pratico': { label: 'Módulos Práticos', icon: FlaskConical, color: 'text-emerald-600 dark:text-emerald-400' },
    'atividade-avaliativa': { label: 'Atividades Avaliativas', icon: ClipboardCheck, color: 'text-amber-600 dark:text-amber-400' },
    'recurso': { label: 'Recursos', icon: FileText, color: 'text-purple-600 dark:text-purple-400' },
}

// Order for display
const typeOrder: ModuleType[] = ['modulo-teorico', 'modulo-pratico', 'atividade-avaliativa', 'recurso']

function groupModulesByType(modules: CourseModule[]): Map<ModuleType, CourseModule[]> {
    const groups = new Map<ModuleType, CourseModule[]>()
    for (const m of modules) {
        const existing = groups.get(m.type) || []
        existing.push(m)
        groups.set(m.type, existing)
    }
    return groups
}

export default async function CourseHomePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const course = await getCourse(slug)
    if (!course) notFound()

    const grouped = groupModulesByType(course.modules)

    return (
        <main className="container mx-auto px-4 py-8 space-y-8">
            {/* Course header */}
            <header className="space-y-2">
                <div className="flex items-center gap-2">
                    <Link href="/disciplinas" className="text-sm text-muted-foreground hover:underline">
                        Disciplinas
                    </Link>
                    <span className="text-muted-foreground">/</span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight">{course.title}</h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="font-mono">{course.code}</span>
                    {course.workload && (
                        <span>
                            {course.workload.theoretical && `${course.workload.theoretical}h teórica`}
                            {course.workload.theoretical && course.workload.practical && ' · '}
                            {course.workload.practical && `${course.workload.practical}h prática`}
                        </span>
                    )}
                </div>
                {course.summary && (
                    <p className="text-muted-foreground max-w-2xl">{course.summary}</p>
                )}
            </header>

            {/* Module groups */}
            {course.modules.length === 0 ? (
                <div className="text-center py-12">
                    <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Nenhum módulo cadastrado para esta disciplina.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {typeOrder.map((type) => {
                        const modules = grouped.get(type)
                        if (!modules?.length) return null
                        const cfg = typeConfig[type]
                        const Icon = cfg.icon

                        return (
                            <section key={type} className="space-y-3">
                                <h2 className={`text-lg font-semibold flex items-center gap-2 ${cfg.color}`}>
                                    <Icon className="h-5 w-5" />
                                    {cfg.label}
                                </h2>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {modules.map((m) => (
                                        <Link
                                            key={m.slug}
                                            href={`/disciplinas/${slug}/${m.slug}`}
                                            className="group block rounded-lg border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30"
                                        >
                                            <div className="flex items-start gap-3">
                                                {m.number != null && (
                                                    <span className={`text-2xl font-bold opacity-30 ${cfg.color}`}>
                                                        {String(m.number).padStart(2, '0')}
                                                    </span>
                                                )}
                                                <div>
                                                    <h3 className="font-medium text-sm leading-snug group-hover:text-primary transition-colors">
                                                        {m.title}
                                                    </h3>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        )
                    })}
                </div>
            )}
        </main>
    )
}
