import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { listTesselas } from "@/lib/payload-content";
import { BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tesselas | Kuara",
  description:
    "Tesselas de pesquisa, notas técnicas e estudos independentes da plataforma Kuara.",
};

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  rascunho: {
    label: "Rascunho",
    className:
      "bg-muted text-muted-foreground",
  },
  "em-andamento": {
    label: "Em andamento",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  finalizado: {
    label: "Finalizado",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  incrementando: {
    label: "Incrementando",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
};

export default async function TesselasPage() {
  const tesselas = await listTesselas();

  return (
    <main className="container mx-auto px-4 py-8 space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Tesselas</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Notas de pesquisa, implementações de artigos, achados de projetos e
          peças de conhecimento que podem ser compostas em novas coisas. Cada
          tessela é um documento vivo conectado aos demais por referências
          explícitas.
        </p>
      </header>

      {tesselas.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhuma tessela publicada.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Crie uma tessela no{" "}
            <Link href="/admin" className="underline">
              painel admin
            </Link>
            .
          </p>
        </div>
      )}

      {tesselas.length > 1 && (
        <div className="flex justify-end">
          <Link
            href="/tesselas/grafo"
            className="text-sm font-medium text-primary hover:underline hover:text-primary/80 transition-colors"
          >
            Ver grafo de conhecimento &rarr;
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tesselas.map((t) => {
          const status = statusConfig[t.stage] ?? statusConfig["rascunho"];
          return (
            <Link
              key={t.slug}
              href={`/tesselas/${t.slug}`}
              className="group relative block rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md"
            >
              {t.coverImage ? (
                <>
                  <Image
                    src={t.coverImage.url}
                    alt={t.coverImage.alt ?? t.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundColor: "rgba(0, 0, 0, 0.55)",
                      backdropFilter: "blur(3px)",
                      WebkitBackdropFilter: "blur(3px)",
                    }}
                  />
                  <div className="relative z-10 p-6 space-y-2 min-h-[160px] flex flex-col justify-end">
                    <h2 className="font-semibold text-lg leading-snug text-white drop-shadow">
                      {t.title}
                    </h2>
                    {t.abstract && (
                      <p className="text-sm text-white/80 line-clamp-3 drop-shadow mb-1">
                        {t.abstract}
                      </p>
                    )}
                    <div className="flex items-center flex-wrap gap-x-1.5 gap-y-2 pt-2 mt-auto">
                      {t.publishedAt && (
                        <span className="text-[11px] text-white/60">
                          {new Date(t.publishedAt).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      )}
                      {t.updatedAt && (
                        <span className="text-[11px] text-white/60">
                          · {new Date(t.updatedAt).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      )}
                      <span className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ml-auto ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="border bg-card p-6 rounded-xl h-full transition-all group-hover:border-primary/30 space-y-2 flex flex-col">
                  <h2 className="font-semibold text-lg leading-snug group-hover:text-primary transition-colors">
                    {t.title}
                  </h2>
                  {t.abstract && (
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-1">
                      {t.abstract}
                    </p>
                  )}
                  <div className="flex items-center flex-wrap gap-x-1.5 gap-y-2 pt-2 mt-auto">
                    {t.publishedAt && (
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(t.publishedAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    )}
                    {t.updatedAt && (
                      <span className="text-[11px] text-muted-foreground">
                        · {new Date(t.updatedAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    )}
                    <span className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ml-auto ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </main>
  );
}
