import Link from "next/link";
import { BookOpen, Puzzle, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-16 max-w-2xl">
      <header className="mb-12 space-y-2">
        <h1 className="text-4xl font-serif font-semibold tracking-tight">
          Kuara
        </h1>
        <p className="text-muted-foreground">Saber irradia de dentro.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/disciplinas"
          className="group flex flex-col gap-3 rounded-xl border bg-card p-6 transition-all hover:border-primary/40 hover:shadow-md"
        >
          <BookOpen className="h-6 w-6 text-primary" />
          <div>
            <h2 className="font-semibold text-lg group-hover:text-primary transition-colors">
              Disciplinas
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Conteúdo das disciplinas disponíveis.
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground mt-auto self-end transition-transform group-hover:translate-x-1" />
        </Link>

        <Link
          href="/tesselas"
          className="group flex flex-col gap-3 rounded-xl border bg-card p-6 transition-all hover:border-primary/40 hover:shadow-md"
        >
          <Puzzle className="h-6 w-6 text-primary" />
          <div>
            <h2 className="font-semibold text-lg group-hover:text-primary transition-colors">
              Tesselas
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Notas de pesquisa e peças de conhecimento conectadas.
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground mt-auto self-end transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </main>
  );
}
