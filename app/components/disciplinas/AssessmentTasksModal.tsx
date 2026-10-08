"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { comBasePath } from "@/lib/base-path";
import {
  MAX_ASSESSMENT_CODE_LENGTH,
  MAX_TASK_NAME_LENGTH,
  formatPoints,
  parseTasks,
  sanitizeCodeInput,
  validateTaskList,
  type AssessmentRow,
  type AssessmentTask,
} from "@/lib/assessment";

const FIELD_CLASS =
  "rounded-md border border-border bg-input px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60";

const LABEL_CLASS =
  "mb-1 block font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground";

/** A task as edited here: new ones have no id yet. */
type DraftTask = { key: string; id?: string; code: string; name: string };

let nextKey = 0;
const draftOf = (task: AssessmentTask): DraftTask => ({
  key: `saved-${task.id}`,
  id: task.id,
  code: task.code ?? "",
  name: task.name,
});

/**
 * The tasks of a checklist assessment: the small things students do one by
 * one, each marked done or not per student. Here they are named, renamed,
 * added and removed; marking them happens in the students table.
 *
 * Tasks can be dragged into another order by their grip; that order is the
 * one of the checkbox columns in the students table.
 *
 * Nothing is saved until "Salvar tarefas" — the list goes to Payload whole,
 * keeping the id of each task that survives so that what students have
 * already done stays attached to it. Leaving with changes not yet saved
 * (a click outside, Esc, the X) asks first.
 */
export function AssessmentTasksModal({
  assessment,
  open,
  onOpenChange,
  onSaved,
}: {
  assessment: AssessmentRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the tasks as saved, ids included. */
  onSaved: (tasks: AssessmentTask[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [tasks, setTasks] = useState<DraftTask[]>(() =>
    assessment.tasks.map(draftOf),
  );
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Asking whether to leave with unsaved changes.
  const [confirmingExit, setConfirmingExit] = useState(false);

  // Anything that "Salvar tarefas" would change, or a name still being typed.
  const dirty =
    name.trim() !== "" ||
    code.trim() !== "" ||
    tasks.length !== assessment.tasks.length ||
    tasks.some(
      (task, index) =>
        task.id !== assessment.tasks[index]?.id ||
        task.code !== (assessment.tasks[index]?.code ?? "") ||
        task.name !== assessment.tasks[index]?.name,
    );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setTasks((list) => {
      const from = list.findIndex((t) => t.key === active.id);
      const to = list.findIndex((t) => t.key === over.id);
      return from === -1 || to === -1 ? list : arrayMove(list, from, to);
    });
  }

  const removedSaved = assessment.tasks.filter(
    (task) => !tasks.some((t) => t.id === task.id),
  ).length;
  const each =
    tasks.length > 0 ? formatPoints(assessment.weight / tasks.length) : null;

  function add(event: FormEvent) {
    event.preventDefault();
    const typed = name.trim().replace(/\s+/g, " ");
    if (!typed) return;
    const checked = validateTaskList([
      ...tasks,
      { code: sanitizeCodeInput(code), name: typed },
    ]);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setError(null);
    setTasks((list) => [
      ...list,
      { key: `new-${nextKey++}`, code: sanitizeCodeInput(code), name: typed },
    ]);
    setName("");
    setCode("");
    input.current?.focus();
  }

  async function save() {
    if (busy) return;
    const checked = validateTaskList(tasks);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        comBasePath(`/api/activities/${assessment.id}?depth=0`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ tasks: checked.tasks }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          res.status === 401 || res.status === 403
            ? "Sua sessão não permite alterar as tarefas. Entre novamente como administrador."
            : "Não foi possível salvar as tarefas. Tente novamente.",
        );
        return;
      }
      onSaved(parseTasks(data?.doc?.tasks));
      onOpenChange(false);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        // A click outside, Esc or the X: with changes pending, ask first.
        if (!next && dirty) setConfirmingExit(true);
        else onOpenChange(next);
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="flex h-dvh max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 w-screen sm:h-auto sm:max-h-[88dvh] sm:w-[min(36rem,calc(100vw-2rem))] sm:rounded-2xl sm:border"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border/60 px-6 py-5 sm:px-8">
          <div className="space-y-1">
            <DialogTitle className="font-serif text-xl tracking-tight">
              Tarefas de{" "}
              <span className="font-mono text-primary">{assessment.code}</span>
            </DialogTitle>
            <DialogDescription>
              {assessment.name} · vale {formatPoints(assessment.weight)}
            </DialogDescription>
          </div>
          <DialogClose
            aria-label="Fechar"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={16} />
          </DialogClose>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6 sm:px-8">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Cada tarefa é marcada como feita ou não feita por discente, na
            tabela de discentes. A nota é a proporção de tarefas feitas sobre o
            total, vezes o valor da avaliação
            {each && (
              <>
                {" "}
                — hoje, cada uma vale cerca de{" "}
                <strong className="text-foreground">{each}</strong>
              </>
            )}
            .
          </p>

          {tasks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
              Nenhuma tarefa ainda. Sem tarefas, esta avaliação não gera nota.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={tasks.map((task) => task.key)}
                strategy={verticalListSortingStrategy}
              >
                <ol className="space-y-1.5">
                  {tasks.map((task, index) => (
                    <SortableTask
                      key={task.key}
                      id={task.key}
                      index={index}
                      code={task.code}
                      name={task.name}
                      disabled={busy}
                      onRecode={(value) =>
                        setTasks((list) =>
                          list.map((t) =>
                            t.key === task.key
                              ? { ...t, code: sanitizeCodeInput(value) }
                              : t,
                          ),
                        )
                      }
                      onRename={(value) =>
                        setTasks((list) =>
                          list.map((t) =>
                            t.key === task.key ? { ...t, name: value } : t,
                          ),
                        )
                      }
                      onRemove={() =>
                        setTasks((list) =>
                          list.filter((t) => t.key !== task.key),
                        )
                      }
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          )}

          <form onSubmit={add} noValidate className="flex items-end gap-2">
            <div className="w-24 shrink-0">
              <label htmlFor="new-task-code" className={LABEL_CLASS}>
                Acrônimo
              </label>
              <input
                id="new-task-code"
                autoComplete="off"
                placeholder="L1"
                maxLength={MAX_ASSESSMENT_CODE_LENGTH}
                value={code}
                onChange={(e) => setCode(sanitizeCodeInput(e.target.value))}
                readOnly={busy}
                className={`${FIELD_CLASS} w-full font-mono`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <label htmlFor="new-task-name" className={LABEL_CLASS}>
                Nova tarefa
              </label>
              <input
                ref={input}
                id="new-task-name"
                autoComplete="off"
                placeholder="Lista 1"
                maxLength={MAX_TASK_NAME_LENGTH}
                value={name}
                onChange={(e) => setName(e.target.value)}
                readOnly={busy}
                className={`${FIELD_CLASS} w-full`}
              />
            </div>
            <Button type="submit" variant="outline" size="sm" disabled={busy}>
              Inserir
            </Button>
          </form>

          {removedSaved > 0 && (
            <p className="rounded-md border-l-4 border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
              {removedSaved === 1
                ? "Uma tarefa já salva será removida"
                : `${removedSaved} tarefas já salvas serão removidas`}
              : as marcações de “feita” que os discentes têm nela se perdem.
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-md border-l-4 border-red-500/30 bg-red-500/5 px-3 py-2 text-xs leading-relaxed text-red-900 dark:text-red-200"
            >
              {error}
            </p>
          )}
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-border/60 px-6 py-4 sm:px-8">
          {/* Said in so many words: no need to ask again. */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={save}>
            {busy && <Loader2 className="animate-spin" />}
            Salvar tarefas
          </Button>
        </footer>

        <Dialog open={confirmingExit} onOpenChange={setConfirmingExit}>
          <DialogContent>
            <DialogTitle>Sair sem salvar?</DialogTitle>
            <DialogDescription>
              As alterações nas tarefas de {assessment.code} ainda não foram
              salvas. Se sair agora, elas se perdem.
            </DialogDescription>
            <div className="flex w-full flex-wrap-reverse items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmingExit(false);
                  onOpenChange(false);
                }}
                className="rounded-md px-2 py-1 text-xs text-red-600/80 transition-colors hover:bg-red-500/10 hover:text-red-600 dark:text-red-300/80 dark:hover:text-red-300"
              >
                Descartar alterações
              </button>
              <Button
                type="button"
                size="sm"
                className="ml-auto"
                onClick={() => setConfirmingExit(false)}
              >
                Continuar editando
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

/** One task of the list: a grip to drag it by, its name, and a bin. */
function SortableTask({
  id,
  index,
  code,
  name,
  disabled,
  onRecode,
  onRename,
  onRemove,
}: {
  id: string;
  index: number;
  code: string;
  name: string;
  disabled: boolean;
  onRecode: (code: string) => void;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-md ${
        isDragging ? "relative z-10 bg-popover shadow-md" : ""
      }`}
    >
      {/* The grip alone starts a drag, so the name stays a normal field. */}
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Mover tarefa ${name || index + 1}`}
        className="inline-flex h-7 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="w-5 shrink-0 text-right font-mono text-xs text-muted-foreground">
        {index + 1}
      </span>
      <input
        aria-label={`Acrônimo da tarefa ${index + 1}`}
        placeholder="—"
        maxLength={MAX_ASSESSMENT_CODE_LENGTH}
        value={code}
        onChange={(e) => onRecode(e.target.value)}
        disabled={disabled}
        className={`${FIELD_CLASS} w-24 shrink-0 font-mono`}
      />
      <input
        aria-label={`Nome da tarefa ${index + 1}`}
        maxLength={MAX_TASK_NAME_LENGTH}
        value={name}
        onChange={(e) => onRename(e.target.value)}
        disabled={disabled}
        className={`${FIELD_CLASS} min-w-0 flex-1`}
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remover tarefa ${name || index + 1}`}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-red-600/60 transition-colors hover:bg-red-500/10 hover:text-red-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500/50 disabled:pointer-events-none disabled:opacity-30 dark:text-red-400/60 dark:hover:text-red-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
