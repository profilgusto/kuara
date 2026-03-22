"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Loader2,
  Lock,
  Unlock,
  AlertTriangle,
  Users,
  User,
  Save,
} from "lucide-react";

/* ---------- Types ---------- */

interface Activity {
  id: string;
  acronym: string;
  description: string;
  weight: number;
  type: "individual" | "group";
  order: number;
}

interface Score {
  id: string;
  activityId: string;
  entityType: "student" | "group";
  studentId?: string;
  groupId?: string;
  percentage: number;
}

interface StudentItem {
  id: string;
  name: string;
}

interface GroupItem {
  id: string;
  name: string;
  studentIds: string[];
}

interface Props {
  offerId: string;
  initialActivities: Activity[];
  initialScores: Score[];
  students: StudentItem[];
  groups: GroupItem[];
}

/* ---------- Component ---------- */

export function GradingClient({
  offerId,
  initialActivities,
  initialScores,
  students,
  groups,
}: Props) {
  const router = useRouter();
  const [activities, setActivities] = useState(initialActivities);
  const [scores, setScores] = useState(initialScores);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Activity creation form
  const [newAcronym, setNewAcronym] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newWeight, setNewWeight] = useState("");
  const [newType, setNewType] = useState<"individual" | "group">("individual");

  const totalWeight = useMemo(
    () => activities.reduce((s, a) => s + a.weight, 0),
    [activities],
  );
  const weightValid = Math.abs(totalWeight - 10) < 0.01;

  // Helper: get the score percentage for a student in an activity
  function getStudentScore(
    studentId: string,
    activityId: string,
  ): number | null {
    const activity = activities.find((a) => a.id === activityId);
    if (!activity) return null;

    if (activity.type === "individual") {
      const score = scores.find(
        (s) => s.activityId === activityId && s.studentId === studentId,
      );
      return score?.percentage ?? null;
    }

    // Group activity — find which group this student belongs to
    const group = groups.find((g) => g.studentIds.includes(studentId));
    if (!group) {
      // Student not in any group, check for individual override
      const individual = scores.find(
        (s) =>
          s.activityId === activityId &&
          s.entityType === "student" &&
          s.studentId === studentId,
      );
      return individual?.percentage ?? null;
    }

    // Check for individual override first
    const individualOverride = scores.find(
      (s) =>
        s.activityId === activityId &&
        s.entityType === "student" &&
        s.studentId === studentId,
    );
    if (individualOverride) return individualOverride.percentage;

    // Fall back to group score
    const groupScore = scores.find(
      (s) =>
        s.activityId === activityId &&
        s.entityType === "group" &&
        s.groupId === group.id,
    );
    return groupScore?.percentage ?? null;
  }

  // Compute final score (0-10) for a student
  function computeFinal(studentId: string): number | null {
    if (!weightValid) return null;
    let total = 0;
    let hasAny = false;
    for (const act of activities) {
      const pct = getStudentScore(studentId, act.id);
      if (pct !== null) {
        total += (pct / 100) * act.weight;
        hasAny = true;
      }
    }
    return hasAny ? Math.round(total * 100) / 100 : null;
  }

  // Update a score locally
  function updateScore(
    activityId: string,
    entityType: "student" | "group",
    entityId: string,
    pct: number,
  ) {
    setScores((prev) => {
      const key =
        entityType === "student"
          ? (s: Score) =>
              s.activityId === activityId && s.studentId === entityId
          : (s: Score) => s.activityId === activityId && s.groupId === entityId;

      const existing = prev.find(key);
      if (existing) {
        return prev.map((s) => (key(s) ? { ...s, percentage: pct } : s));
      }
      return [
        ...prev,
        {
          id: `new-${Date.now()}-${Math.random()}`,
          activityId,
          entityType,
          studentId: entityType === "student" ? entityId : undefined,
          groupId: entityType === "group" ? entityId : undefined,
          percentage: pct,
        },
      ];
    });
  }

  // Apply group score to all members
  function applyGroupScore(activityId: string, groupId: string, pct: number) {
    updateScore(activityId, "group", groupId, pct);
    // Remove individual overrides for students in this group
    const group = groups.find((g) => g.id === groupId);
    if (group) {
      setScores((prev) =>
        prev.filter(
          (s) =>
            !(
              s.activityId === activityId &&
              s.entityType === "student" &&
              group.studentIds.includes(s.studentId || "")
            ),
        ),
      );
    }
  }

  async function createActivity() {
    if (!newAcronym.trim() || !newDesc.trim() || !newWeight) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          offer: offerId,
          acronym: newAcronym.trim(),
          description: newDesc.trim(),
          weight: parseFloat(newWeight),
          type: newType,
          order: activities.length,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setActivities((prev) => [
          ...prev,
          {
            id: data.doc.id,
            acronym: data.doc.acronym,
            description: data.doc.description,
            weight: data.doc.weight,
            type: data.doc.type,
            order: data.doc.order || 0,
          },
        ]);
        setNewAcronym("");
        setNewDesc("");
        setNewWeight("");
      } else {
        setError("Não foi possível criar a atividade. Tente novamente.");
      }
    } catch {
      setError("Erro de conexão ao criar a atividade.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteActivity(actId: string) {
    setActivities((prev) => prev.filter((a) => a.id !== actId));
    setScores((prev) => prev.filter((s) => s.activityId !== actId));
    try {
      const res = await fetch(`/api/activities/${actId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        setError("Erro ao excluir a atividade no servidor.");
      }
    } catch {
      setError("Erro de conexão ao excluir a atividade.");
    }
  }

  async function saveAllScores() {
    setSaving(true);
    setError(null);
    try {
      const requests = scores.map((score) => {
        if (score.id.startsWith("new-")) {
          return fetch("/api/scores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              offer: offerId,
              activity: score.activityId,
              entityType: score.entityType,
              student: score.studentId || undefined,
              group: score.groupId || undefined,
              percentage: score.percentage,
            }),
          });
        }
        return fetch(`/api/scores/${score.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ percentage: score.percentage }),
        });
      });
      const results = await Promise.allSettled(requests);
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        setError(`${failed} nota(s) não puderam ser salvas. Tente novamente.`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Erro de conexão ao salvar as notas.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="px-4 py-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-xs underline shrink-0"
          >
            Fechar
          </button>
        </div>
      )}
      {/* Activity Configuration */}
      <section>
        <h2 className="text-base font-semibold mb-4">Atividades & Pesos</h2>

        {/* Weight summary */}
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-4 ${
            weightValid
              ? "bg-green-500/10 text-green-700 dark:text-green-400"
              : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
          }`}
        >
          {weightValid ? null : <AlertTriangle className="h-4 w-4 shrink-0" />}
          Soma dos pesos: <strong>{totalWeight.toFixed(1)}</strong> / 10.0
          {!weightValid && " — ajuste os pesos para que somem 10.0"}
        </div>

        {/* Existing activities */}
        <div className="space-y-2 mb-4">
          {activities.map((act) => (
            <div
              key={act.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg border text-sm"
            >
              <span className="font-mono font-bold text-primary w-12 shrink-0">
                {act.acronym}
              </span>
              <span className="flex-1 truncate">{act.description}</span>
              <span className="flex items-center gap-1 text-muted-foreground shrink-0">
                {act.type === "group" ? (
                  <Users className="h-3.5 w-3.5" />
                ) : (
                  <User className="h-3.5 w-3.5" />
                )}
                {act.type === "group" ? "Grupo" : "Individual"}
              </span>
              <span className="font-medium shrink-0 w-14 text-right">
                {act.weight.toFixed(1)}
              </span>
              <button
                onClick={() => deleteActivity(act.id)}
                className="text-muted-foreground hover:text-destructive transition-colors p-1 shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* New activity form */}
        <div className="flex flex-wrap gap-2 items-end">
          <input
            type="text"
            placeholder="Sigla (ex: AV)"
            value={newAcronym}
            onChange={(e) => setNewAcronym(e.target.value.toUpperCase())}
            className="w-20 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <input
            type="text"
            placeholder="Descrição"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="flex-1 min-w-[120px] rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <input
            type="number"
            placeholder="Peso"
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
            step="0.1"
            min="0"
            max="10"
            className="w-20 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as any)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="individual">Individual</option>
            <option value="group">Grupo</option>
          </select>
          <button
            onClick={createActivity}
            disabled={saving || !newAcronym.trim()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </button>
        </div>
      </section>

      {/* Grading Matrix */}
      {activities.length > 0 && students.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Planilha de Notas</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditing(!editing)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  editing
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                    : "border hover:bg-muted"
                }`}
              >
                {editing ? (
                  <Unlock className="h-3 w-3" />
                ) : (
                  <Lock className="h-3 w-3" />
                )}
                {editing ? "Editando" : "Editar notas"}
              </button>
              {editing && (
                <button
                  onClick={saveAllScores}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                  Salvar
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-3 py-2 font-medium sticky left-0 bg-muted/30 z-10 min-w-[160px]">
                    Aluno
                  </th>
                  {activities.map((act) => (
                    <th
                      key={act.id}
                      className="text-center px-2 py-2 font-medium min-w-[80px]"
                      title={`${act.description} (Peso: ${act.weight})`}
                    >
                      <div className="flex flex-col items-center">
                        <span className="font-mono text-primary">
                          {act.acronym}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-normal">
                          {act.weight.toFixed(1)}
                        </span>
                      </div>
                    </th>
                  ))}
                  <th className="text-center px-3 py-2 font-bold min-w-[80px] bg-primary/5">
                    Final
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, idx) => {
                  const final = computeFinal(student.id);
                  return (
                    <tr
                      key={student.id}
                      className={`border-b last:border-b-0 ${
                        idx % 2 === 0 ? "" : "bg-muted/10"
                      }`}
                    >
                      <td className="px-3 py-2 font-medium sticky left-0 bg-inherit z-10 truncate max-w-[200px]">
                        {student.name}
                      </td>
                      {activities.map((act) => {
                        const pct = getStudentScore(student.id, act.id);
                        const isGroupActivity = act.type === "group";
                        const studentGroup = isGroupActivity
                          ? groups.find((g) =>
                              g.studentIds.includes(student.id),
                            )
                          : null;

                        return (
                          <td key={act.id} className="text-center px-1 py-1">
                            {editing ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <input
                                  type="number"
                                  value={pct ?? ""}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val) && val >= 0 && val <= 100) {
                                      updateScore(
                                        act.id,
                                        "student",
                                        student.id,
                                        val,
                                      );
                                    }
                                  }}
                                  min={0}
                                  max={100}
                                  step={1}
                                  className="w-16 rounded border bg-background px-1 py-0.5 text-center text-xs outline-none focus:ring-1 focus:ring-primary/40"
                                  placeholder="—"
                                />
                                {isGroupActivity && studentGroup && (
                                  <button
                                    onClick={() => {
                                      const val = pct ?? 0;
                                      applyGroupScore(
                                        act.id,
                                        studentGroup.id,
                                        val,
                                      );
                                    }}
                                    className="text-[9px] text-primary hover:underline"
                                    title={`Aplicar para ${studentGroup.name}`}
                                  >
                                    → {studentGroup.name}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span
                                className={
                                  pct !== null
                                    ? "text-foreground"
                                    : "text-muted-foreground/40"
                                }
                              >
                                {pct !== null ? `${pct}%` : "—"}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="text-center px-3 py-2 font-bold bg-primary/5">
                        {final !== null ? (
                          <span
                            className={
                              final >= 5
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }
                          >
                            {final.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!weightValid && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />A nota final só será
              calculada corretamente quando os pesos somarem 10.0
            </p>
          )}
        </section>
      )}

      {activities.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-xl">
          Adicione atividades acima para começar a registrar notas.
        </p>
      )}
    </div>
  );
}
