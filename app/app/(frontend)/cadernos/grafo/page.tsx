import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listAllCadernosForGraph } from "@/lib/payload-content";
import { CadernosGraph } from "@/components/cadernos/CadernosGraph";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Grafo de Cadernos | Kuara",
  description: "Visualização das relações de conhecimento entre os cadernos.",
};

export default async function GrafoPage() {
  const data = await listAllCadernosForGraph();

  return (
    <main className="container mx-auto px-4 py-8 flex flex-col h-[calc(100vh-80px)] min-h-[700px] gap-6">
      <header className="shrink-0 space-y-2">
        <Link
          href="/cadernos"
          className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar para Lista
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Grafo de Conhecimento</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Visualização das dependências direcionais e conceitos conectados por referências.
          </p>
        </div>
      </header>

      <div className="flex-1 w-full bg-card rounded-xl shadow-sm border overflow-hidden">
        {data.length > 0 ? (
          <CadernosGraph data={data} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Você precisa de cadernos publicados para visualizar o grafo.
          </div>
        )}
      </div>
    </main>
  );
}
