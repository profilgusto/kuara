"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BookOpen,
  FlaskConical,
  ClipboardCheck,
  FileText,
  LayoutList,
  Rows3,
} from "lucide-react";
import { type CourseModule, type ModuleType } from "@/lib/payload-content";

const typeConfig: Record<
  ModuleType,
  { label: string; icon: typeof BookOpen; color: string }
> = {
  "modulo-teorico": {
    label: "Módulos Teóricos",
    icon: BookOpen,
    color: "text-blue-600 dark:text-blue-400",
  },
  "modulo-pratico": {
    label: "Módulos Práticos",
    icon: FlaskConical,
    color: "text-emerald-600 dark:text-emerald-400",
  },
  "atividade-avaliativa": {
    label: "Atividades Avaliativas",
    icon: ClipboardCheck,
    color: "text-amber-600 dark:text-amber-400",
  },
  recurso: {
    label: "Recursos",
    icon: FileText,
    color: "text-purple-600 dark:text-purple-400",
  },
};

const typeOrder: ModuleType[] = [
  "modulo-teorico",
  "modulo-pratico",
  "atividade-avaliativa",
  "recurso",
];

interface CourseModuleListProps {
  modules: CourseModule[];
  courseSlug: string;
}

export function CourseModuleList({
  modules,
  courseSlug,
}: CourseModuleListProps) {
  const [view, setView] = useState<"grouped" | "sequence">("grouped");

  const sortedModules = [...modules].sort((a, b) => a.order - b.order);

  const grouped = new Map<ModuleType, CourseModule[]>();
  for (const m of modules) {
    const existing = grouped.get(m.type) || [];
    existing.push(m);
    grouped.set(m.type, existing);
  }

  return (
    <div className="space-y-6">
      {/* View toggle */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-0.5 rounded-md border border-border/60 p-0.5 bg-muted/30">
          <button
            onClick={() => setView("grouped")}
            title="Agrupar por tipo"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${view === "grouped" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <LayoutList className="h-3.5 w-3.5" />
            Grupos
          </button>
          <button
            onClick={() => setView("sequence")}
            title="Ver em sequência"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${view === "sequence" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Rows3 className="h-3.5 w-3.5" />
            Sequência
          </button>
        </div>
      </div>

      {/* Grouped view */}
      {view === "grouped" && (
        <div className="space-y-8">
          {typeOrder.map((type) => {
            const mods = grouped.get(type);
            if (!mods?.length) return null;
            const cfg = typeConfig[type];
            const Icon = cfg.icon;

            return (
              <section key={type} className="space-y-3">
                <h2
                  className={`text-lg font-semibold flex items-center gap-2 ${cfg.color}`}
                >
                  <Icon className="h-5 w-5" />
                  {cfg.label}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {mods.map((m) => (
                    <Link
                      key={m.slug}
                      href={`/disciplinas/${courseSlug}/${m.slug}`}
                      className="group block rounded-lg border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30"
                    >
                      <div className="flex items-center gap-3">
                        {m.number != null && (
                          <span
                            className={`text-sm font-mono font-semibold opacity-40 shrink-0 ${cfg.color}`}
                          >
                            {String(m.number).padStart(2, "0")}
                          </span>
                        )}
                        <h3 className="font-medium text-sm leading-snug group-hover:text-primary transition-colors">
                          {m.title}
                        </h3>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Sequence view */}
      {view === "sequence" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortedModules.map((m, idx) => {
            const cfg = typeConfig[m.type];
            const Icon = cfg.icon;

            return (
              <Link
                key={m.slug}
                href={`/disciplinas/${courseSlug}/${m.slug}`}
                className="group block rounded-lg border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono font-semibold opacity-40 shrink-0 tabular-nums">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                  <h3 className="font-medium text-sm leading-snug group-hover:text-primary transition-colors">
                    {m.title}
                  </h3>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
