/**
 * lib/payload-content.ts
 *
 * Data access layer for Telaclass pages.
 * Replaces the old filesystem-based content.ts with Payload CMS API calls.
 */
import { getPayload } from "payload";
import configPromise from "@payload-config";
import type { CitationStyle } from "@/lib/citation-shared";

export type ModuleType =
  | "modulo-teorico"
  | "modulo-pratico"
  | "atividade-avaliativa"
  | "recurso";

export interface CourseListItem {
  slug: string;
  title: string;
  code: string;
  summary?: string;
}

export interface CourseModule {
  id: string;
  title: string;
  slug: string;
  type: ModuleType;
  order: number;
  visible: boolean;
  content?: string;
  /** Citation style for <Cite> components in this module */
  citationStyle?: CitationStyle;
  /** Auto-assigned number within its type group (teórico: 1,2,3...; prático: 1,2,3...) */
  number?: number | null;
}

export interface CourseDetail {
  id: string;
  code: string;
  title: string;
  slug: string;
  summary?: string;
  workload?: { theoretical?: number; practical?: number };
  modules: CourseModule[];
}

/**
 * List all courses (for /disciplinas index page).
 */
export async function listCourses(): Promise<CourseListItem[]> {
  const payload = await getPayload({ config: configPromise });
  const result = await payload.find({
    collection: "courses",
    where: { visibility: { equals: true } },
    limit: 100,
    sort: "title",
  });

  return result.docs.map((doc: any) => ({
    slug: doc.slug,
    title: doc.title,
    code: doc.code,
    summary: doc.summary || undefined,
  }));
}

/**
 * Get a single course by slug, with all its visible modules.
 * If draft is true, fetches draft modules and draft course data.
 */
export async function getCourse(
  slug: string,
  draft: boolean = false,
): Promise<CourseDetail | null> {
  const payload = await getPayload({ config: configPromise });
  const decodedSlug = decodeURIComponent(slug);
  const courseResult = await payload.find({
    collection: "courses",
    where: { slug: { equals: decodedSlug } },
    limit: 1,
    draft,
  });

  const course = courseResult.docs[0] as any;
  if (!course || course.visibility === false) return null;

  // Fetch modules for this course
  const modulesResult = await payload.find({
    collection: "modules",
    where: {
      course: { equals: course.id },
      visible: { equals: true },
    },
    sort: "order",
    limit: 100,
    draft,
  });

  // Auto-assign numbers by type (teórico: 1,2,3...; prático: 1,2,3...)
  let teoricoCounter = 1;
  let praticoCounter = 1;

  const modules: CourseModule[] = modulesResult.docs.map((m: any) => ({
    id: m.id,
    title: m.title,
    slug: m.slug,
    type: m.type as ModuleType,
    order: m.order,
    visible: m.visible,
    content: m.content || undefined,
    number:
      m.type === "modulo-teorico"
        ? teoricoCounter++
        : m.type === "modulo-pratico"
          ? praticoCounter++
          : null,
  }));

  return {
    id: course.id,
    code: course.code,
    title: course.title,
    slug: course.slug,
    summary: course.summary || undefined,
    workload: course.workload || undefined,
    modules,
  };
}

/**
 * Get a specific module's content by course slug + module slug.
 */
export async function getModule(
  courseSlug: string,
  moduleSlug: string,
  draft: boolean = false,
): Promise<{
  module: CourseModule;
  courseTitle: string;
  courseSlug: string;
} | null> {
  const payload = await getPayload({ config: configPromise });

  // Next.js does not always decode dynamic route params — decode explicitly
  const decodedCourseSlug = decodeURIComponent(courseSlug);
  const decodedModuleSlug = decodeURIComponent(moduleSlug);

  // Find the course first
  const courseResult = await payload.find({
    collection: "courses",
    where: { slug: { equals: decodedCourseSlug } },
    limit: 1,
    draft,
  });
  const course = courseResult.docs[0] as any;
  if (!course || course.visibility === false) return null;

  // Find the module
  const moduleResult = await payload.find({
    collection: "modules",
    where: {
      course: { equals: course.id },
      slug: { equals: decodedModuleSlug },
    },
    limit: 1,
    draft,
  });
  const mod = moduleResult.docs[0] as any;
  if (!mod) return null;

  return {
    module: {
      id: mod.id,
      title: mod.title,
      slug: mod.slug,
      type: mod.type as ModuleType,
      order: mod.order,
      visible: mod.visible,
      content: mod.content || undefined,
      citationStyle: (mod.citationStyle as CitationStyle) || "authoryear",
      number: null, // not needed on detail page
    },
    courseTitle: course.title,
    courseSlug: course.slug,
  };
}

/**
 * List paginated public posts (news/announcements).
 * Only fetches posts where status = 'published' and offer is not set (general news).
 */
export async function getPosts(
  page: number = 1,
  limit: number = 10,
): Promise<{ docs: any[]; totalPages: number }> {
  const payload = await getPayload({ config: configPromise });
  const result = await payload.find({
    collection: "posts",
    where: {
      status: { equals: "published" },
      offer: { exists: false }, // Only general news
    },
    sort: "-publishedAt", // descending by date
    page,
    limit,
  });

  return {
    docs: result.docs,
    totalPages: result.totalPages,
  };
}

/**
 * Get a single public post by its slug.
 */
export async function getPost(slug: string): Promise<any | null> {
  const payload = await getPayload({ config: configPromise });
  const result = await payload.find({
    collection: "posts",
    where: {
      slug: { equals: slug },
      status: { equals: "published" },
      offer: { exists: false },
    },
    limit: 1,
  });

  return result.docs[0] || null;
}
