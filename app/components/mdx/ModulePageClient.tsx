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
  questionOffsets,
}: {
  children: ReactNode;
  title: string;
  headings: Heading[];
  courseTitle: string;
  slideCover?: SlideCoverData | null;
  questionOffsets?: Record<string, number>;
}) {
  return (
    <ModuleContext.Provider value={{ title }}>
      <ContentPageClient
        title={title}
        headings={headings}
        slideCover={slideCover}
        printContextLabel={courseTitle}
        questionOffsets={questionOffsets}
      >
        {children}
      </ContentPageClient>
    </ModuleContext.Provider>
  );
}
