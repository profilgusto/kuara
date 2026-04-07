import type { Metadata } from "next";
import Link from "next/link";
import { listAllTesselasForGraph } from "@/lib/payload-content";
import { BookOpen } from "lucide-react";
import { FilteredTesselaGrid } from "@/components/tesselas/FilteredTesselaGrid";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tesselas | Kuara",
  description:
    "Tesselas de pesquisa, notas técnicas e estudos independentes da plataforma Kuara.",
};

export default async function TesselasPage() {
  const tesselas = await listAllTesselasForGraph();

  return (
    <main className="container mx-auto px-4 py-8 space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Tesselas</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-xs sm:text-sm">
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

      <FilteredTesselaGrid tesselas={tesselas} showMosaico={tesselas.length > 1} />
    </main>
  );
}
