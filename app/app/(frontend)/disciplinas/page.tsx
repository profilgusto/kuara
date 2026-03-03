import Link from 'next/link'
import { listCourses } from '@/lib/payload-content'
import { BookOpen } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DisciplinasPage() {
    const courses = await listCourses()

    return (
        <main className="container mx-auto px-4 py-8 space-y-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Disciplinas</h1>
                <p className="text-muted-foreground mt-1">
                    Conteúdos das disciplinas disponíveis
                </p>
            </header>

            {courses.length === 0 && (
                <div className="text-center py-12">
                    <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Nenhuma disciplina cadastrada.</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        Cadastre uma disciplina no <Link href="/admin" className="underline">painel admin</Link>.
                    </p>
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map((c) => (
                    <Link
                        key={c.slug}
                        href={`/disciplinas/${c.slug}`}
                        className="group block rounded-xl border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/30"
                    >
                        <div className="space-y-2">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                                {c.code}
                            </span>
                            <h2 className="font-semibold text-lg leading-snug group-hover:text-primary transition-colors">
                                {c.title}
                            </h2>
                            {c.summary && (
                                <p className="text-sm text-muted-foreground line-clamp-3">
                                    {c.summary}
                                </p>
                            )}
                        </div>
                    </Link>
                ))}
            </div>
        </main>
    )
}
