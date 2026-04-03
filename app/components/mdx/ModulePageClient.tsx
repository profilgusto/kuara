"use client";

import { ReactNode } from "react";
import { ModuleContext } from "./ModuleContext";
import { ContentPageClient } from "@/components/content/ContentPageClient";
import type { Heading } from "@/lib/mdx-pipeline";
import type { SlideCoverData } from "@/lib/slides";

export function ModulePageClient({
  children,
  title,
  headings,
  courseTitle,
  slideCover,
}: {
  children: ReactNode;
  title: string;
  headings: Heading[];
  courseTitle: string;
  slideCover?: SlideCoverData | null;
}) {
  return (
    <ModuleContext.Provider value={{ title }}>
      <ContentPageClient
        title={title}
        headings={headings}
        slideCover={slideCover}
        printContextLabel={courseTitle}
      >
        {children}
      </ContentPageClient>
    </ModuleContext.Provider>
  );
}
