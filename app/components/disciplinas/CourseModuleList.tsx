"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Monitor,
  ClipboardCheck,
  FileText,
  GripVertical,
  LayoutList,
  Loader2,
  Pencil,
  Plus,
  Rows3,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { useEditMode } from "@/components/layout/EditModeContext";
import { comBasePath } from "@/lib/base-path";
import {
  moveModule,
  numberModules,
  placeholderModuleSlug,
  planOrderUpdates,
} from "@/lib/module-order";
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
    icon: Monitor,
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

const CARD_CLASS = "rounded-lg border bg-card p-4 shadow-sm transition-all";

interface CourseModuleListProps {
  modules: CourseModule[];
  courseSlug: string;
  courseId: string | number;
}

/**
 * A module card. Normally a link to the module; while reordering, a handle
 * to drag instead, so a drag never ends in a navigation.
 */
function ModuleCard({
  module,
  href,
  reordering,
  disabled,
  children,
}: {
  module: CourseModule;
  href: string;
  reordering: boolean;
  disabled: boolean;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id, disabled: !reordering || disabled });

  if (!reordering) {
    return (
      <Link
        href={href}
        className={`group block ${CARD_CLASS} hover:shadow-md hover:border-primary/30`}
      >
        <div className="flex items-center gap-3">{children}</div>
      </Link>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-label={`Mover ${module.title}`}
      className={`${CARD_CLASS} touch-none select-none border-dashed border-primary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
        isDragging
          ? "relative z-10 cursor-grabbing shadow-lg opacity-90"
          : disabled
            ? "opacity-60"
            : "cursor-grab hover:border-primary"
      }`}
    >
      <div className="flex items-center gap-3">
        <GripVertical className="-ml-1.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
        {children}
      </div>
    </div>
  );
}

/**
 * The "ghost" card at the end of the list, in edit mode. Creates an empty
 * draft module in this course and opens it in the Payload admin, in a new
 * tab, where it gets its real title, slug, type and content. Being a draft, it stays off
 * the public page until published; it enters the course in last place
 * (hooks/assignModuleOrder.ts).
 */
function AddModuleCard({ courseId }: { courseId: string | number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (busy) return;
    setBusy(true);
    setError(null);
    // Opened now, empty, and pointed at the module once it exists: a tab
    // opened after the request comes back is no longer tied to the click, and
    // browsers block it as a pop-up.
    const tab = window.open("", "_blank");
    try {
      const res = await fetch(comBasePath("/api/modules?draft=true&depth=0"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: "Novo módulo",
          slug: placeholderModuleSlug(),
          course: courseId,
          _status: "draft",
        }),
      });
      const data = await res.json().catch(() => null);
      const id = data?.doc?.id;
      if (!res.ok || id == null) {
        tab?.close();
        setError(
          res.status === 401 || res.status === 403
            ? "Sua sessão não permite criar módulos. Entre novamente como administrador."
            : "Não foi possível criar o módulo. Tente novamente.",
        );
        return;
      }
      const url = comBasePath(`/payload/collections/modules/${id}`);
      if (tab) {
        // The admin has no business reaching back into this page.
        tab.opener = null;
        tab.location.href = url;
      } else {
        // The browser refused the new tab; the module exists, so go to it.
        window.location.assign(url);
      }
    } catch {
      tab?.close();
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={create}
        disabled={busy}
        className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border p-4 text-left text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <Plus className="h-4 w-4 shrink-0" />
        )}
        {busy ? "Criando módulo…" : "Adicionar novo módulo"}
      </button>
      {error && (
        <p
          role="alert"
          className="rounded-md border-l-4 border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-900 dark:text-red-200"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export function CourseModuleList({
  modules,
  courseSlug,
  courseId,
}: CourseModuleListProps) {
  const router = useRouter();
  const { editing } = useEditMode();
  const [view, setView] = useState<"grouped" | "sequence">("grouped");

  // The arrangement just saved, shown until the server re-render that
  // follows a save delivers it as `modules`.
  const [justSaved, setJustSaved] = useState<CourseModule[] | null>(null);
  useEffect(() => setJustSaved(null), [modules]);

  const saved = justSaved ?? [...modules].sort((a, b) => a.order - b.order);

  // The arrangement being dragged; null when not reordering.
  const [draft, setDraft] = useState<CourseModule[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Leaving edit mode drops an unsaved arrangement.
  useEffect(() => {
    if (!editing) {
      setDraft(null);
      setError(null);
    }
  }, [editing]);

  const reordering = editing && draft !== null;
  const sequence = reordering ? numberModules(draft) : saved;
  const changed = reordering && draft.some((m, i) => m.id !== saved[i]?.id);

  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so a plain click on a
    // card is not taken for one.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function onDragEnd(withinType: boolean) {
    return ({ active, over }: DragEndEvent) => {
      if (!over) return;
      setDraft(
        (current) =>
          current && moveModule(current, active.id, over.id, withinType),
      );
    };
  }

  function discard() {
    setDraft(null);
    setError(null);
  }

  async function save() {
    if (!draft || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Every module of the course, not just the ones listed here: the
      // hidden ones hold places in the same sequence.
      const res = await fetch(
        comBasePath(
          `/api/modules?where[course][equals]=${courseId}&sort=order&depth=0&limit=500&select[order]=true`,
        ),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("list");
      const all: { id: string | number; order?: number }[] = (await res.json())
        .docs;

      for (const update of planOrderUpdates(
        all,
        draft.map((m) => m.id),
      )) {
        const patch = await fetch(
          comBasePath(`/api/modules/${update.id}?depth=0`),
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ order: update.order }),
          },
        );
        if (!patch.ok) throw new Error(String(patch.status));
      }
      setJustSaved(numberModules(draft));
      setDraft(null);
    } catch (err) {
      const status = err instanceof Error ? err.message : "";
      setError(
        status === "401" || status === "403"
          ? "Sua sessão não permite reordenar os módulos. Entre novamente como administrador."
          : "Não foi possível salvar a ordem. Confira a ordem atual e tente novamente.",
      );
    } finally {
      setBusy(false);
      // Also after a failure: some modules may already have moved.
      router.refresh();
    }
  }

  const grouped = new Map<ModuleType, CourseModule[]>();
  for (const m of sequence) {
    const existing = grouped.get(m.type) || [];
    existing.push(m);
    grouped.set(m.type, existing);
  }

  const href = (m: CourseModule) => `/disciplinas/${courseSlug}/${m.slug}`;

  // Not while reordering: the list is a drag surface then.
  const addCard = editing && !reordering && (
    <AddModuleCard courseId={courseId} />
  );

  if (modules.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Nenhum módulo cadastrado para esta disciplina.
          </p>
        </div>
        {addCard && <div className="mx-auto max-w-sm">{addCard}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* View toggle, and the reorder controls beside it in edit mode */}
      <div className="flex flex-wrap items-center justify-center gap-2">
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

        {editing && !reordering && (
          <button
            type="button"
            onClick={() => setDraft(saved)}
            aria-label="Reordenar módulos"
            title="Reordenar módulos"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}

        {reordering && (
          <>
            <Button size="sm" disabled={busy || !changed} onClick={save}>
              {busy && <Loader2 className="animate-spin" />}
              Salvar ordem
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={discard}>
              Descartar alterações
            </Button>
          </>
        )}
      </div>

      {reordering && (
        <p className="text-center text-xs text-muted-foreground">
          {view === "grouped"
            ? "Arraste os cards para reordenar dentro de cada grupo. Para mover entre módulos de tipos diferentes, use a visão Sequência."
            : "Arraste os cards para reordenar os módulos da disciplina."}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mx-auto max-w-xl rounded-md border-l-4 border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-900 dark:text-red-200"
        >
          {error}
        </p>
      )}

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
                {/* One drag area per group: a card cannot leave its type. */}
                <DndContext
                  id={`modules-${type}`}
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onDragEnd(true)}
                >
                  <SortableContext
                    items={mods.map((m) => m.id)}
                    strategy={rectSortingStrategy}
                  >
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {mods.map((m) => (
                        <ModuleCard
                          key={m.slug}
                          module={m}
                          href={href(m)}
                          reordering={reordering}
                          disabled={busy}
                        >
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
                        </ModuleCard>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </section>
            );
          })}
          {addCard && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {addCard}
            </div>
          )}
        </div>
      )}

      {/* Sequence view: one column at every width, so it reads top to bottom */}
      {view === "sequence" && (
        <DndContext
          id="modules-sequence"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd(false)}
        >
          <SortableContext
            items={sequence.map((m) => m.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-3">
              {sequence.map((m, idx) => {
                const cfg = typeConfig[m.type];
                const Icon = cfg.icon;

                return (
                  <ModuleCard
                    key={m.slug}
                    module={m}
                    href={href(m)}
                    reordering={reordering}
                    disabled={busy}
                  >
                    <span className="text-sm font-mono font-semibold opacity-40 shrink-0 tabular-nums">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                    <h3 className="font-medium text-sm leading-snug group-hover:text-primary transition-colors">
                      {m.title}
                    </h3>
                  </ModuleCard>
                );
              })}
              {addCard}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
