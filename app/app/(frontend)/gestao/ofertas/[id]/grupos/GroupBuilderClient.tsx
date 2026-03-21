"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Trash2, Loader2, GripVertical, User } from "lucide-react";

interface Student {
  id: string;
  name: string;
}

interface Group {
  id: string;
  name: string;
  students: Student[];
}

interface Props {
  offerId: string;
  initialUnassigned: Student[];
  initialGroups: Group[];
}

export function GroupBuilderClient({
  offerId,
  initialUnassigned,
  initialGroups,
}: Props) {
  const router = useRouter();
  const [unassigned, setUnassigned] = useState(initialUnassigned);
  const [groups, setGroups] = useState(initialGroups);
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [saving, setSaving] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor),
  );

  function findStudent(
    id: string,
  ): { student: Student; source: string } | null {
    const fromUnassigned = unassigned.find((s) => s.id === id);
    if (fromUnassigned)
      return { student: fromUnassigned, source: "unassigned" };
    for (const g of groups) {
      const fromGroup = g.students.find((s) => s.id === id);
      if (fromGroup) return { student: fromGroup, source: g.id };
    }
    return null;
  }

  function handleDragStart(event: DragStartEvent) {
    const found = findStudent(String(event.active.id));
    setActiveStudent(found?.student || null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveStudent(null);
    const { active, over } = event;
    if (!over) return;

    const studentId = String(active.id);
    const targetId = String(over.id); // group id or 'unassigned'
    const found = findStudent(studentId);
    if (!found) return;

    const { student, source } = found;
    if (source === targetId) return; // dropped in same container

    // Remove from source
    if (source === "unassigned") {
      setUnassigned((prev) => prev.filter((s) => s.id !== studentId));
    } else {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === source
            ? { ...g, students: g.students.filter((s) => s.id !== studentId) }
            : g,
        ),
      );
    }

    // Add to target
    if (targetId === "unassigned") {
      setUnassigned((prev) => [...prev, student]);
    } else {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === targetId ? { ...g, students: [...g.students, student] } : g,
        ),
      );
    }
  }

  async function createGroup() {
    if (!newGroupName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/student-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newGroupName.trim(),
          offer: offerId,
          students: [],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGroups((prev) => [
          ...prev,
          { id: data.doc.id, name: data.doc.name, students: [] },
        ]);
        setNewGroupName("");
      }
    } catch (err) {
      console.error("Failed to create group:", err);
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup(groupId: string) {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    // Move students back to unassigned
    setUnassigned((prev) => [...prev, ...group.students]);
    setGroups((prev) => prev.filter((g) => g.id !== groupId));

    // Delete from API
    try {
      await fetch(`/api/student-groups/${groupId}`, {
        method: "DELETE",
        credentials: "include",
      });
    } catch (err) {
      console.error("Failed to delete group:", err);
    }
  }

  async function saveAllGroups() {
    setSaving(true);
    try {
      // Update each group's students in Payload
      await Promise.all(
        groups.map((g) =>
          fetch(`/api/student-groups/${g.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ students: g.students.map((s) => s.id) }),
          }),
        ),
      );
      router.refresh();
    } catch (err) {
      console.error("Failed to save groups:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Unassigned students */}
        <div className="lg:w-72 shrink-0">
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
            Sem grupo ({unassigned.length})
          </h3>
          <DroppableZone id="unassigned">
            {unassigned.map((s) => (
              <DraggableStudent key={s.id} student={s} />
            ))}
            {unassigned.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Todos os alunos estão em grupos.
              </p>
            )}
          </DroppableZone>
        </div>

        {/* Right: Groups */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Grupos ({groups.length})
            </h3>
            <button
              onClick={saveAllGroups}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Salvar Grupos
            </button>
          </div>

          {/* Create new group */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Nome do novo grupo..."
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createGroup()}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={createGroup}
              disabled={saving || !newGroupName.trim()}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-md border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Criar
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {groups.map((group) => (
              <div key={group.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">{group.name}</h4>
                  <button
                    onClick={() => deleteGroup(group.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    title="Excluir grupo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <DroppableZone id={group.id}>
                  {group.students.map((s) => (
                    <DraggableStudent key={s.id} student={s} />
                  ))}
                  {group.students.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Arraste alunos aqui
                    </p>
                  )}
                </DroppableZone>
              </div>
            ))}
          </div>
          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-xl">
              Crie um grupo acima para começar a organizar os alunos.
            </p>
          )}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeStudent ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-sm font-medium shadow-lg">
            <User className="h-3.5 w-3.5" />
            {activeStudent.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DroppableZone({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[80px] rounded-xl border-2 border-dashed p-2 transition-colors ${
        isOver ? "border-primary/50 bg-primary/5" : "border-border"
      }`}
    >
      {children}
    </div>
  );
}

function DraggableStudent({ student }: { student: Student }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: student.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border text-sm cursor-grab active:cursor-grabbing hover:bg-muted/50 transition-colors mb-1"
    >
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="truncate">{student.name}</span>
    </div>
  );
}
