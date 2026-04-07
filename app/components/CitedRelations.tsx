import Link from "next/link";
import { Puzzle, BookOpen } from "lucide-react";
import type { TesselaRelatedItem, ModuleRelatedItem } from "@/lib/payload-content";

/* ── Badge configs ─────────────────────────────────────────────────────────── */

const stageClass: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  "em-andamento":
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  finalizado:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  incrementando:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

const moduleTypeLabel: Record<string, string> = {
  "modulo-teorico": "Módulo Teórico",
  "modulo-pratico": "Módulo Prático",
  "atividade-avaliativa": "Atividade Avaliativa",
  recurso: "Recurso",
};

const moduleTypeClass: Record<string, string> = {
  "modulo-teorico":
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  "modulo-pratico":
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  "atividade-avaliativa":
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  recurso: "bg-muted text-muted-foreground",
};

/* ── Cards ─────────────────────────────────────────────────────────────────── */

function TesselaCard({ t }: { t: TesselaRelatedItem }) {
  return (
    <Link
      href={`/tesselas/${t.slug}`}
      className="block border rounded-xl p-4 hover:border-primary/50 transition-colors space-y-2 group"
    >
      <div className="flex items-start gap-2">
        <Puzzle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-primary/60 group-hover:text-primary transition-colors" />
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {t.stage && (
              <span
                className={`text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded-full ${stageClass[t.stage] ?? stageClass.rascunho}`}
              >
                {t.stage === "em-andamento"
                  ? "Em andamento"
                  : t.stage.charAt(0).toUpperCase() + t.stage.slice(1)}
              </span>
            )}
          </div>
          <p className="text-sm font-medium leading-snug text-foreground">
            {t.title}
          </p>
          {t.abstract && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {t.abstract}
            </p>
          )}
          {t.tags && t.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {t.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function ModuleCard({ m }: { m: ModuleRelatedItem }) {
  return (
    <Link
      href={`/disciplinas/${m.courseSlug}/${m.slug}`}
      className="block border rounded-xl p-4 hover:border-secondary/50 transition-colors space-y-2 group"
    >
      <div className="flex items-start gap-2">
        <BookOpen className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-secondary/60 group-hover:text-secondary transition-colors" />
        <div className="flex flex-col gap-1 min-w-0">
          {m.type && (
            <span
              className={`self-start text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded-full ${moduleTypeClass[m.type] ?? moduleTypeClass.recurso}`}
            >
              {moduleTypeLabel[m.type] ?? m.type}
            </span>
          )}
          <p className="text-sm font-medium leading-snug text-foreground">
            {m.title}
          </p>
        </div>
      </div>
    </Link>
  );
}

/* ── Section ────────────────────────────────────────────────────────────────── */

function RelationsSection({
  title,
  tesselas,
  modules,
}: {
  title: string;
  tesselas: TesselaRelatedItem[];
  modules: ModuleRelatedItem[];
}) {
  if (tesselas.length === 0 && modules.length === 0) return null;

  return (
    <div>
      <h2 className="text-base font-semibold mb-3">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {tesselas.map((t) => (
          <TesselaCard key={`t-${t.id}`} t={t} />
        ))}
        {modules.map((m) => (
          <ModuleCard key={`m-${m.id}`} m={m} />
        ))}
      </div>
    </div>
  );
}

/* ── Public API ─────────────────────────────────────────────────────────────── */

interface CitedRelationsProps {
  /** Items this document cites (outgoing) */
  citedTesselas?: TesselaRelatedItem[];
  citedModules?: ModuleRelatedItem[];
  /** Items that cite this document (incoming) */
  citedByTesselas?: TesselaRelatedItem[];
  citedByModules?: ModuleRelatedItem[];
}

export default function CitedRelations({
  citedTesselas = [],
  citedModules = [],
  citedByTesselas = [],
  citedByModules = [],
}: CitedRelationsProps) {
  const hasCited = citedTesselas.length > 0 || citedModules.length > 0;
  const hasCitedBy = citedByTesselas.length > 0 || citedByModules.length > 0;

  if (!hasCited && !hasCitedBy) return null;

  return (
    <>
      <RelationsSection
        title="Conteúdo citado"
        tesselas={citedTesselas}
        modules={citedModules}
      />
      <RelationsSection
        title="Citado por"
        tesselas={citedByTesselas}
        modules={citedByModules}
      />
    </>
  );
}
