"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CourseDetail } from "@/lib/payload-content";
import { Heading } from "@/lib/mdx-pipeline";
import { BookOpen, FlaskConical, ClipboardCheck, FileText } from "lucide-react";
import { useViewMode } from "./useViewMode";

interface CourseSidebarProps {
  course: CourseDetail;
  currentModuleSlug?: string;
  headings?: Heading[];
  onLinkClick?: () => void;
}

const typeConfig: Record<
  string,
  { label: string; icon: typeof BookOpen; color: string }
> = {
  "modulo-teorico": {
    label: "Módulos Teóricos",
    icon: BookOpen,
    color: "text-blue-500",
  },
  "modulo-pratico": {
    label: "Módulos Práticos",
    icon: FlaskConical,
    color: "text-emerald-500",
  },
  "atividade-avaliativa": {
    label: "Atividades",
    icon: ClipboardCheck,
    color: "text-amber-500",
  },
  recurso: { label: "Recursos", icon: FileText, color: "text-purple-500" },
};

export function CourseSidebar({
  course,
  currentModuleSlug,
  headings = [],
  onLinkClick,
}: CourseSidebarProps) {
  const pathname = usePathname();
  const viewMode = useViewMode();
  const [activeHeading, setActiveHeading] = useState<string | null>(null);

  // Scroll spy for headings
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveHeading(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -80% 0px" },
    );

    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  // Sort all modules by absolute order
  const sortedModules = [...course.modules].sort((a, b) => a.order - b.order);

  return (
    <nav className="p-4 space-y-4 text-sm overflow-y-auto overscroll-contain h-full">
      <div className="mb-2">
        <Link
          href={`/disciplinas/${course.slug}`}
          className="text-base font-semibold leading-snug tracking-tight hover:underline flex flex-col gap-1"
        >
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            {course.code}
          </span>
          {course.title}
        </Link>
      </div>

      <div className="space-y-1">
        {sortedModules.map((m, idx) => {
          const href = `/disciplinas/${course.slug}/${m.slug}`;
          const isActive = pathname === href;
          const isCurrentModule = currentModuleSlug === m.slug;
          const cfg = typeConfig[m.type];
          const Icon = cfg.icon;

          return (
            <div key={m.id}>
              <Link
                href={href}
                onClick={onLinkClick}
                className={`flex items-baseline gap-2 py-1 transition-colors hover:text-primary ${isActive ? "font-medium text-primary" : "text-muted-foreground"}`}
              >
                <Icon
                  className={`h-3.5 w-3.5 shrink-0 self-center ${isActive ? "text-primary" : ""}`}
                />
                <span className="shrink-0 tabular-nums">{idx + 1}.</span>
                <span>{m.title}</span>
              </Link>

              {/* Show headings if this is the currently active module */}
              {isCurrentModule && headings.length > 0 && (
                <ul className="ml-6 mt-2 mb-2 space-y-2 border-l-2 border-muted pl-3 text-[13px]">
                  {headings.map((h) => {
                    const isHeadingActive = activeHeading === h.id;
                    return (
                      <li
                        key={h.id}
                        style={{ paddingLeft: `${(h.level - 1) * 0.75}rem` }}
                      >
                        <a
                          href={`#${h.id}`}
                          className={`block transition-colors line-clamp-2 ${
                            isHeadingActive
                              ? "font-medium text-primary"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          onClick={(e) => {
                            e.preventDefault();
                            if (viewMode === "apresentacao") {
                              const headingEl = document.getElementById(h.id);
                              const slideId = headingEl
                                ?.closest("section[data-id]")
                                ?.getAttribute("data-id");
                              if (slideId) {
                                window.dispatchEvent(
                                  new CustomEvent("slidedeck:goto", {
                                    detail: { id: slideId },
                                  }),
                                );
                              }
                            } else {
                              document
                                .getElementById(h.id)
                                ?.scrollIntoView({ behavior: "smooth" });
                              history.pushState(null, "", `#${h.id}`);
                            }
                            onLinkClick?.();
                          }}
                        >
                          {h.text}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
