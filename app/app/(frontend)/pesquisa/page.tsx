import { Construction } from 'lucide-react'

export const metadata = {
    title: 'Pesquisa | Biofloresta',
    description: 'Conheça nossos projetos de pesquisa e extensão.',
}

export default function PesquisaPage() {
    return (
        <div className="container mx-auto px-4 py-24 max-w-4xl text-center">
            <div className="flex justify-center mb-8">
                <div className="bg-primary/10 p-4 rounded-full">
                    <Construction className="h-12 w-12 text-primary" />
                </div>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl mb-6">
                Pesquisa & Extensão
            </h1>
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
                Esta página está em construção. Em breve, disponibilizaremos informações completas sobre nossos laboratórios, projetos em andamento, grupos de estudo e publicações científicas.
            </p>
        </div>
    )
}
