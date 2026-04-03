"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useConfig } from "@payloadcms/ui";

/* ── Types ─────────────────────────────────────────────────── */

interface ModuleTodos {
  id: string;
  title: string;
  slug: string;
  courseId: string;
  courseTitle: string;
  todos: string[];
}

interface CadernoTodos {
  id: string;
  title: string;
  slug: string;
  todos: string[];
}

interface CourseGroup {
  courseTitle: string;
  modules: ModuleTodos[];
}

/* ── Helpers ────────────────────────────────────────────────── */

function extractTodos(content: string): string[] {
  const todos: string[] = [];
  const regex = /<Todo>([\s\S]*?)<\/Todo>/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const text = match[1].trim();
    if (text) todos.push(text);
  }
  return todos;
}

function groupByCourse(modules: ModuleTodos[]): [string, CourseGroup][] {
  const map = new Map<string, CourseGroup>();
  for (const m of modules) {
    if (!map.has(m.courseId)) {
      map.set(m.courseId, { courseTitle: m.courseTitle, modules: [] });
    }
    map.get(m.courseId)!.modules.push(m);
  }
  return Array.from(map.entries()).sort(([, a], [, b]) =>
    a.courseTitle.localeCompare(b.courseTitle),
  );
}

/* ── Component ──────────────────────────────────────────────── */

export const TodosView: React.FC = () => {
  const {
    config: {
      routes: { api },
    },
  } = useConfig();

  const [moduleTodos, setModuleTodos] = useState<ModuleTodos[]>([]);
  const [cadernoTodos, setCadernoTodos] = useState<CadernoTodos[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalTodos, setTotalTodos] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    const fetchModules = fetch(`${api}/modules?limit=500&depth=1&draft=true`, {
      credentials: "include",
    }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} (modules)`);
      return r.json();
    });

    const fetchCadernos = fetch(
      `${api}/cadernos?limit=500&depth=0&draft=true`,
      { credentials: "include" },
    ).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} (cadernos)`);
      return r.json();
    });

    Promise.all([fetchModules, fetchCadernos])
      .then(([modulesData, cadernosData]) => {
        // ── Modules ──
        const moduleDocs: Record<string, unknown>[] = modulesData.docs ?? [];
        const moduleResult: ModuleTodos[] = [];
        let count = 0;

        for (const doc of moduleDocs) {
          const content = typeof doc.content === "string" ? doc.content : "";
          const todos = extractTodos(content);
          if (todos.length === 0) continue;

          count += todos.length;
          const course =
            doc.course && typeof doc.course === "object"
              ? (doc.course as { id: string; title?: string })
              : { id: String(doc.course ?? ""), title: "—" };

          moduleResult.push({
            id: String(doc.id),
            title: String(doc.title ?? "—"),
            slug: String(doc.slug ?? ""),
            courseId: course.id,
            courseTitle: course.title ?? "—",
            todos,
          });
        }

        moduleResult.sort((a, b) => {
          const c = a.courseTitle.localeCompare(b.courseTitle);
          return c !== 0 ? c : a.title.localeCompare(b.title);
        });

        // ── Cadernos ──
        const cadernoDocs: Record<string, unknown>[] = cadernosData.docs ?? [];
        const cadernoResult: CadernoTodos[] = [];

        for (const doc of cadernoDocs) {
          const content = typeof doc.content === "string" ? doc.content : "";
          const todos = extractTodos(content);
          if (todos.length === 0) continue;

          count += todos.length;
          cadernoResult.push({
            id: String(doc.id),
            title: String(doc.title ?? "—"),
            slug: String(doc.slug ?? ""),
            todos,
          });
        }

        cadernoResult.sort((a, b) => a.title.localeCompare(b.title));

        setModuleTodos(moduleResult);
        setCadernoTodos(cadernoResult);
        setTotalTodos(count);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  /* ── Render ── */

  if (loading) {
    return (
      <div
        style={{
          padding: "40px",
          textAlign: "center",
          color: "var(--theme-elevation-500, #888)",
        }}
      >
        Carregando TODOs…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "40px", color: "#e57373" }}>
        Erro ao carregar módulos: {error}
      </div>
    );
  }

  const groups = groupByCourse(moduleTodos);
  const hasAny = groups.length > 0 || cadernoTodos.length > 0;

  const sourceCount =
    moduleTodos.length + cadernoTodos.length;

  return (
    <div style={{ padding: "32px", maxWidth: "860px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "28px",
          gap: "16px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: "var(--theme-elevation-1000, #fff)",
              margin: "0 0 6px",
            }}
          >
            TODOs de Conteúdo
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "var(--theme-elevation-500, #888)",
              margin: 0,
            }}
          >
            {hasAny
              ? `${totalTodos} item${totalTodos !== 1 ? "s" : ""} pendente${totalTodos !== 1 ? "s" : ""} em ${sourceCount} documento${sourceCount !== 1 ? "s" : ""}`
              : "Nenhum TODO encontrado nos módulos ou cadernos."}
          </p>
        </div>

        <button
          onClick={load}
          style={{
            padding: "7px 14px",
            fontSize: "12px",
            fontWeight: 500,
            fontFamily: "inherit",
            borderRadius: "4px",
            border: "1px solid var(--theme-elevation-400, #555)",
            background: "var(--theme-elevation-100, #222)",
            color: "var(--theme-elevation-800, #ccc)",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Atualizar
        </button>
      </div>

      {/* Empty state */}
      {!hasAny && (
        <div
          style={{
            padding: "48px 24px",
            textAlign: "center",
            border: "1px dashed var(--theme-elevation-300, #444)",
            borderRadius: "8px",
            color: "var(--theme-elevation-500, #888)",
            fontSize: "14px",
          }}
        >
          Nenhum bloco <code style={{ fontFamily: "monospace" }}>&lt;Todo&gt;</code> encontrado.
        </div>
      )}

      {/* Module groups */}
      {groups.length > 0 && (
        <>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.8px",
              textTransform: "uppercase",
              color: "#2FA8B8",
              paddingBottom: "8px",
              marginBottom: "16px",
              borderBottom: "2px solid var(--theme-elevation-200, #333)",
            }}
          >
            Módulos
          </div>

          {groups.map(([courseId, { courseTitle, modules }]) => (
            <div key={courseId} style={{ marginBottom: "32px" }}>
              {/* Course header */}
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.8px",
                  textTransform: "uppercase",
                  color: "var(--theme-elevation-500, #888)",
                  paddingBottom: "8px",
                  marginBottom: "12px",
                  borderBottom: "1px solid var(--theme-elevation-200, #333)",
                }}
              >
                {courseTitle}
              </div>

              {/* Modules */}
              {modules.map((mod) => (
                <div
                  key={mod.id}
                  style={{
                    marginBottom: "16px",
                    background: "var(--theme-elevation-100, #1a1a1a)",
                    border: "1px solid var(--theme-elevation-300, #3a3a3a)",
                    borderRadius: "6px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderBottom: "1px solid var(--theme-elevation-200, #333)",
                      gap: "12px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "var(--theme-elevation-1000, #fff)",
                      }}
                    >
                      Módulo: {mod.title}
                    </span>
                    <a
                      href={`/admin/collections/modules/${mod.id}`}
                      style={{
                        fontSize: "11px",
                        color: "#2FA8B8",
                        textDecoration: "none",
                        flexShrink: 0,
                        fontFamily: "monospace",
                      }}
                    >
                      editar →
                    </a>
                  </div>

                  <ul style={{ margin: 0, padding: "10px 14px 10px 28px" }}>
                    {mod.todos.map((text, i) => (
                      <li
                        key={i}
                        style={{
                          fontSize: "13px",
                          color: "var(--theme-elevation-800, #ccc)",
                          marginBottom: i < mod.todos.length - 1 ? "6px" : 0,
                          lineHeight: 1.5,
                          whiteSpace: "pre-wrap",
                          fontFamily: "monospace",
                        }}
                      >
                        {text}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {/* Cadernos section */}
      {cadernoTodos.length > 0 && (
        <>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.8px",
              textTransform: "uppercase",
              color: "#2FA8B8",
              paddingBottom: "8px",
              marginBottom: "16px",
              marginTop: groups.length > 0 ? "8px" : 0,
              borderBottom: "2px solid var(--theme-elevation-200, #333)",
            }}
          >
            Cadernos
          </div>

          {cadernoTodos.map((caderno) => (
            <div
              key={caderno.id}
              style={{
                marginBottom: "16px",
                background: "var(--theme-elevation-100, #1a1a1a)",
                border: "1px solid var(--theme-elevation-300, #3a3a3a)",
                borderRadius: "6px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--theme-elevation-200, #333)",
                  gap: "12px",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--theme-elevation-1000, #fff)",
                  }}
                >
                  Caderno: {caderno.title}
                </span>
                <a
                  href={`/admin/collections/cadernos/${caderno.id}`}
                  style={{
                    fontSize: "11px",
                    color: "#2FA8B8",
                    textDecoration: "none",
                    flexShrink: 0,
                    fontFamily: "monospace",
                  }}
                >
                  editar →
                </a>
              </div>

              <ul style={{ margin: 0, padding: "10px 14px 10px 28px" }}>
                {caderno.todos.map((text, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: "13px",
                      color: "var(--theme-elevation-800, #ccc)",
                      marginBottom: i < caderno.todos.length - 1 ? "6px" : 0,
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                      fontFamily: "monospace",
                    }}
                  >
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default TodosView;
