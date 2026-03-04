import { GraduationCap, LockKeyhole } from 'lucide-react'

export const metadata = {
    title: 'Área do Aluno | Biofloresta',
    description: 'Acesso exclusivo para alunos matriculados nas disciplinas.',
}

export default function AlunoPage() {
    return (
        <div className="container mx-auto px-4 py-24 max-w-4xl text-center">
            <div className="flex justify-center mb-8">
                <div className="bg-amber-500/10 p-4 rounded-full">
                    <GraduationCap className="h-12 w-12 text-amber-500" />
                </div>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl mb-6">
                Área do Aluno
            </h1>
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
                A Área do Aluno permitirá o acompanhamento de notas, progresso nas disciplinas e acesso a comunicados exclusivos das ofertas matriculadas.
            </p>

            <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-full text-sm font-medium">
                <LockKeyhole className="h-4 w-4" />
                <span>Autenticação em desenvolvimento (Fase 4)</span>
            </div>
        </div>
    )
}
