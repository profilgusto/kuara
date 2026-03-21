"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Megaphone,
  Loader2,
} from "lucide-react";

interface Module {
  id: string;
  title: string;
  slug: string;
  type: string;
  order: number;
}

interface Post {
  id: string;
  title: string;
  slug: string;
  publishedAt: string | null;
}

interface Student {
  id: string;
  name: string;
}

interface Props {
  offerId: string;
  modules: Module[];
  currentModuleId: string | null;
  posts: Post[];
  students: Student[];
}

export function OfferDashboardClient({
  offerId,
  modules,
  currentModuleId,
  posts,
  students,
}: Props) {
  const router = useRouter();
  const [activeModuleId, setActiveModuleId] = useState(currentModuleId);
  const [saving, setSaving] = useState(false);

  async function setCurrentModule(moduleId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentModule: moduleId,
          logs: [
            {
              timestamp: new Date().toISOString(),
              action: "Módulo atual atualizado",
              details: `Módulo definido como: ${modules.find((m) => m.id === moduleId)?.title}`,
            },
          ],
        }),
      });
      if (res.ok) {
        setActiveModuleId(moduleId);
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to update module:", err);
    } finally {
      setSaving(false);
    }
  }

  // Find the index of the current module relative to the list
  const currentIndex = modules.findIndex((m) => m.id === activeModuleId);

  return (
    <div className="space-y-10">
      {/* Module Progression */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Progressão de Módulos
        </h2>
        <div className="space-y-1">
          {modules.map((mod, i) => {
            const isCompleted = currentIndex >= 0 && i < currentIndex;
            const isCurrent = mod.id === activeModuleId;
            const isFuture = currentIndex >= 0 && i > currentIndex;

            return (
              <button
                key={mod.id}
                onClick={() => setCurrentModule(mod.id)}
                disabled={saving}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm transition-all ${
                  isCurrent
                    ? "bg-primary/10 border border-primary/30 text-foreground font-medium"
                    : isCompleted
                      ? "text-muted-foreground hover:bg-muted/50"
                      : "text-muted-foreground/60 hover:bg-muted/30"
                }`}
              >
                {saving && isCurrent ? (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                ) : isCompleted ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                ) : isCurrent ? (
                  <div className="h-4 w-4 rounded-full border-2 border-primary bg-primary/20 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0" />
                )}
                <span className="truncate">{mod.title}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wider opacity-60">
                  {mod.type === "modulo-teorico"
                    ? "Teórico"
                    : mod.type === "modulo-pratico"
                      ? "Prático"
                      : mod.type === "atividade-avaliativa"
                        ? "Avaliação"
                        : "Recurso"}
                </span>
              </button>
            );
          })}
        </div>
        {modules.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum módulo cadastrado nesta disciplina.
          </p>
        )}
      </section>

      {/* Recent Announcements */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          Comunicados Recentes
        </h2>
        {posts.length > 0 ? (
          <div className="space-y-2">
            {posts.slice(0, 5).map((post) => (
              <div
                key={post.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg border text-sm"
              >
                <span className="font-medium truncate">{post.title}</span>
                <span className="text-xs text-muted-foreground shrink-0 ml-3">
                  {post.publishedAt
                    ? new Date(post.publishedAt).toLocaleDateString("pt-BR")
                    : "—"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum comunicado publicado para esta oferta.
          </p>
        )}
      </section>

      {/* Student list summary */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-primary">📋</span>
          Alunos Matriculados ({students.length})
        </h2>
        {students.length > 0 ? (
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {students.map((s) => (
              <div
                key={s.id}
                className="px-3 py-2 rounded-md border text-sm truncate"
              >
                {s.name}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum aluno matriculado.
          </p>
        )}
      </section>
    </div>
  );
}
