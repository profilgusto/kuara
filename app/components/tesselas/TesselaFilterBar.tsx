"use client";

import { X, ListFilter } from "lucide-react";
import { cn } from "@/lib/utils";

const stageLabels: Record<string, string> = {
  rascunho: "Rascunho",
  "em-andamento": "Em andamento",
  finalizado: "Finalizado",
  incrementando: "Incrementando",
};

export interface FilterState {
  tags: string[];
  projects: string[];
  stages: string[];
}

interface TesselaFilterBarProps {
  allTags: string[];
  allProjects: string[];
  allStages: string[];
  filters: FilterState;
  onTagToggle: (tag: string) => void;
  onProjectToggle: (project: string) => void;
  onStageToggle: (stage: string) => void;
  onClear: () => void;
}

function Pill({
  label,
  active,
  onClick,
  variant,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  variant: "stage" | "project" | "tag";
}) {
  const activeClasses: Record<typeof variant, string> = {
    stage:
      "bg-primary text-primary-foreground border-primary",
    project:
      "bg-foreground text-background border-foreground",
    tag: "bg-muted-foreground/20 text-foreground border-muted-foreground/40",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-all whitespace-nowrap",
        active
          ? activeClasses[variant]
          : "bg-transparent text-muted-foreground border-border hover:border-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

export function TesselaFilterBar({
  allTags,
  allProjects,
  allStages,
  filters,
  onTagToggle,
  onProjectToggle,
  onStageToggle,
  onClear,
}: TesselaFilterBarProps) {
  const hasFilters =
    filters.tags.length > 0 ||
    filters.projects.length > 0 ||
    filters.stages.length > 0;

  const hasAny = allTags.length > 0 || allProjects.length > 0 || allStages.length > 0;

  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <ListFilter size={14} className="text-muted-foreground shrink-0" />
      {allStages.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {allStages.map((stage) => (
            <Pill
              key={stage}
              label={stageLabels[stage] ?? stage}
              active={filters.stages.includes(stage)}
              onClick={() => onStageToggle(stage)}
              variant="stage"
            />
          ))}
        </div>
      )}

      {allStages.length > 0 && allProjects.length > 0 && (
        <span className="text-border">|</span>
      )}

      {allProjects.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {allProjects.map((project) => (
            <Pill
              key={project}
              label={project}
              active={filters.projects.includes(project)}
              onClick={() => onProjectToggle(project)}
              variant="project"
            />
          ))}
        </div>
      )}

      {allProjects.length > 0 && allTags.length > 0 && (
        <span className="text-border">|</span>
      )}

      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {allTags.map((tag) => (
            <Pill
              key={tag}
              label={tag}
              active={filters.tags.includes(tag)}
              onClick={() => onTagToggle(tag)}
              variant="tag"
            />
          ))}
        </div>
      )}

      {hasFilters && (
        <>
          <span className="text-border">|</span>
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Limpar <X size={10} />
          </button>
        </>
      )}
    </div>
  );
}

export function useFilterState() {
  // Returned as a hook-like factory — used by both pages
  // Actual state lives in each consumer component
}

export function applyFilters<
  T extends { tags: string[]; project: string[]; stage: string }
>(items: T[], filters: FilterState): T[] {
  return items.filter((item) => {
    if (
      filters.stages.length > 0 &&
      !filters.stages.includes(item.stage)
    )
      return false;
    if (
      filters.projects.length > 0 &&
      !filters.projects.some((p) => item.project.includes(p))
    )
      return false;
    if (
      filters.tags.length > 0 &&
      !filters.tags.some((t) => item.tags.includes(t))
    )
      return false;
    return true;
  });
}

export function deriveFilterOptions<
  T extends { tags: string[]; project: string[]; stage: string }
>(items: T[]) {
  const tags = [...new Set(items.flatMap((i) => i.tags))].sort();
  const projects = [...new Set(items.flatMap((i) => i.project))].sort();
  const stages = [...new Set(items.map((i) => i.stage))];
  // Keep stages in logical order
  const stageOrder = ["rascunho", "em-andamento", "finalizado", "incrementando"];
  stages.sort((a, b) => stageOrder.indexOf(a) - stageOrder.indexOf(b));
  return { tags, projects, stages };
}
