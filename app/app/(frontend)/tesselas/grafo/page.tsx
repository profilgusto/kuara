import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listAllTesselasForGraph } from "@/lib/payload-content";
import { TesselasGraph } from "@/components/tesselas/TesselasGraph";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mosaico | Kuara",
  description: "Visualização das relações de conhecimento entre as tesselas.",
};

export default async function MosaicoPage() {
  const data = await listAllTesselasForGraph();

  return (
    <main className="container mx-auto px-4 py-8 flex flex-col h-[calc(100vh-80px)] min-h-[700px] gap-6">
      <header className="shrink-0 space-y-2">
        <Link
          href="/tesselas"
          className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar para Lista
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mosaico</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Visualização das dependências direcionais e conceitos conectados por referências.
          </p>
        </div>
      </header>

      <div className="flex-1 w-full bg-card rounded-xl shadow-sm border overflow-hidden">
        {data.length > 0 ? (
          <TesselasGraph data={data} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Você precisa de tesselas publicadas para visualizar o Mosaico.
          </div>
        )}
      </div>
    </main>
  );
}
