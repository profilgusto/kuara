"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { comBasePath } from "@/lib/base-path";
import type { RosterGroup } from "@/lib/group-roster";

type Loaded = { groups: RosterGroup[]; ungrouped: string[] };

/**
 * "Grupos": a collapsible block on the course page, under "Avaliações", with
 * the work groups of the offer and their members, by abbreviated name.
 *
 * Public, read on first expansion from `/api/student-groups/public`, which
 * returns names only — never matrículas.
 */
export function CourseGroups({ offerId }: { offerId: string | number }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(
        comBasePath(`/api/student-groups/public?offer=${offerId}`),
      );
      if (!res.ok) throw new Error("groups");
      setLoaded(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded && !loading) void load();
  }

  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <section className="rounded-lg border bg-card shadow-sm">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="course-groups"
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Chevron className="h-4 w-4 shrink-0 text-muted-foreground" />
        Grupos
      </button>

      {open && (
        <div id="course-groups" className="border-t">
          {loading && (
            <p className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="m-3 rounded-md border-l-4 border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-900 dark:text-red-200"
            >
              Não foi possível carregar os grupos.{" "}
              <button type="button" onClick={load} className="underline">
                Tentar novamente
              </button>
            </p>
          )}
          {loaded &&
            loaded.groups.length === 0 &&
            loaded.ungrouped.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhum grupo cadastrado nesta oferta.
              </p>
            )}
          {loaded &&
            (loaded.groups.length > 0 || loaded.ungrouped.length > 0) && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="w-40 px-4 py-3 font-semibold">
                        Grupo
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Membros
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {loaded.groups.map((group) => (
                      <tr key={group.id} className="align-top">
                        <th
                          scope="row"
                          className="px-4 py-2.5 text-left font-medium"
                        >
                          {group.name}
                        </th>
                        <td className="px-4 py-2.5">
                          {group.members.length > 0 ? (
                            <ul className="space-y-0.5">
                              {group.members.map((name, i) => (
                                <li key={`${i}-${name}`}>{name}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {loaded.ungrouped.length > 0 && (
                      <tr className="align-top">
                        <th
                          scope="row"
                          className="px-4 py-2.5 text-left font-medium italic text-muted-foreground"
                        >
                          Sem grupo
                        </th>
                        <td className="px-4 py-2.5">
                          <ul className="space-y-0.5">
                            {loaded.ungrouped.map((name, i) => (
                              <li key={`${i}-${name}`}>{name}</li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}
    </section>
  );
}
