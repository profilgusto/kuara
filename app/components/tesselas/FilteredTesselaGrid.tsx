"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Eye } from "lucide-react";
import {
  TesselaFilterBar,
  applyFilters,
  deriveFilterOptions,
  type FilterState,
} from "./TesselaFilterBar";

const TesselasGraph = dynamic(
  () => import("./TesselasGraph").then((m) => m.TesselasGraph),
  { ssr: false }
);

interface TesselaItem {
  id: string;
  slug: string;
  title: string;
  abstract?: string | null;
  stage: string;
  tags: string[];
  project: string[];
  publishedAt?: string | null;
  updatedAt?: string | null;
  coverImage?: { url: string; alt?: string } | null;
  relatedTesselas: { id: string }[];
}

const statusConfig: Record<string, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

interface FilteredTesselaGridProps {
  tesselas: TesselaItem[];
  showMosaico?: boolean;
}

export function FilteredTesselaGrid({ tesselas, showMosaico }: FilteredTesselaGridProps) {
  const [view, setView] = useState<"list" | "mosaico">("list");
  const [filters, setFilters] = useState<FilterState>({
    tags: [],
    projects: [],
    stages: [],
  });

  const { tags: allTags, projects: allProjects, stages: allStages } =
    useMemo(() => deriveFilterOptions(tesselas), [tesselas]);

  const visible = useMemo(
    () => applyFilters(tesselas, filters),
    [tesselas, filters]
  );

  function toggleTag(tag: string) {
    setFilters((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }));
  }

  function toggleProject(project: string) {
    setFilters((f) => ({
      ...f,
      projects: f.projects.includes(project)
        ? f.projects.filter((p) => p !== project)
        : [...f.projects, project],
    }));
  }

  function toggleStage(stage: string) {
    setFilters((f) => ({
      ...f,
      stages: f.stages.includes(stage)
        ? f.stages.filter((s) => s !== stage)
        : [...f.stages, stage],
    }));
  }

  return (
    <div className="space-y-6">
      {/* View toggle + filter bar on the same line */}
      <div className="flex items-center gap-2">
        {showMosaico && (
          <div className="shrink-0 flex items-center gap-1.5 text-muted-foreground">
            <Eye className="h-3.5 w-3.5" />
            <button
              onClick={() => setView(view === "list" ? "mosaico" : "list")}
              aria-label={view === "list" ? "Ver Mosaico" : "Ver Lista"}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-border text-muted-foreground transition-all whitespace-nowrap hover:border-muted-foreground hover:text-foreground"
            >
              {view === "list" ? "Lista" : "Mosaico"}
            </button>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <TesselaFilterBar
            allTags={allTags}
            allProjects={allProjects}
            allStages={allStages}
            filters={filters}
            onTagToggle={toggleTag}
            onProjectToggle={toggleProject}
            onStageToggle={toggleStage}
            onClear={() => setFilters({ tags: [], projects: [], stages: [] })}
          />
        </div>
      </div>

      {view === "mosaico" ? (
        <div className="w-full bg-card rounded-xl shadow-sm border overflow-hidden h-[calc(100vh-220px)] min-h-[600px]">
          <TesselasGraph data={visible} />
        </div>
      ) : (
        <>
          {visible.length === 0 && (
            <p className="text-muted-foreground text-sm py-8 text-center">
              Nenhuma tessela corresponde aos filtros selecionados.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((t) => {
              const status = statusConfig[t.stage] ?? statusConfig["rascunho"];
              return (
                <Link
                  key={t.slug}
                  href={`/tesselas/${t.slug}`}
                  className="group relative block rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md"
                >
                  {/* Tag chips — top-right corner */}
                  {t.tags.length > 0 && (
                    <div className="absolute top-3 right-3 z-20 flex flex-wrap justify-end gap-1">
                      {t.tags.slice(0, 3).map((tag) =>
                        t.coverImage ? (
                          <span
                            key={tag}
                            className="text-[9px] uppercase tracking-wider bg-black/40 text-white/80 px-1.5 py-0.5 rounded-sm backdrop-blur-sm"
                          >
                            {tag}
                          </span>
                        ) : (
                          <span
                            key={tag}
                            className="text-[9px] uppercase tracking-wider border bg-background/80 text-muted-foreground px-1.5 py-0.5 rounded-sm"
                          >
                            {tag}
                          </span>
                        )
                      )}
                    </div>
                  )}

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
                        {t.project.length > 0 && (
                          <span className="text-[10px] uppercase tracking-wider font-bold text-white/60">
                            {t.project.join(" · ")}
                          </span>
                        )}
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
                              {formatDate(t.publishedAt)}
                            </span>
                          )}
                          {t.updatedAt && (
                            <span className="text-[11px] text-white/60">
                              · {formatDate(t.updatedAt)}
                            </span>
                          )}
                          <span
                            className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ml-auto ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="border bg-card p-6 rounded-xl h-full transition-all group-hover:border-primary/30 space-y-2 flex flex-col">
                      {t.project.length > 0 && (
                        <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                          {t.project.join(" · ")}
                        </span>
                      )}
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
                            {formatDate(t.publishedAt)}
                          </span>
                        )}
                        {t.updatedAt && (
                          <span className="text-[11px] text-muted-foreground">
                            · {formatDate(t.updatedAt)}
                          </span>
                        )}
                        <span
                          className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ml-auto ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </div>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
