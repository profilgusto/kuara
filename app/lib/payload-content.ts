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
  coverImage?: string;
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
    coverImage: doc.coverImage?.url || undefined,
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

// ---------------------------------------------------------------------------
// Tesselas
// ---------------------------------------------------------------------------

export interface TesselaListItem {
  id: string;
  slug: string;
  title: string;
  abstract?: string;
  stage: "rascunho" | "em-andamento" | "finalizado" | "incrementando";
  tags: string[];
  project: string[];
  publishedAt?: string;
  updatedAt?: string;
  coverImage?: { url: string; alt?: string } | null;
}

export interface TesselaRelatedItem {
  id: string;
  slug: string;
  title: string;
  abstract?: string;
  tags: string[];
  stage: string;
}

export interface TesselaDetail {
  id: string;
  slug: string;
  title: string;
  abstract?: string;
  stage: string;
  tags: string[];
  project: string[];
  publishedAt?: string;
  updatedAt?: string;
  coverImage?: { url: string; alt?: string } | null;
  content?: string;
  citationStyle?: string;
  relatedDisciplinas?: { id: string; slug: string; title: string; code: string }[];
  relatedModules?: { id: string; slug: string; title: string; courseSlug: string }[];
  relatedTesselas?: TesselaRelatedItem[];
  referencedBy?: TesselaRelatedItem[];
}

/** Extract tags from the `tags` text field (semicolon-separated). */
function extractTags(rawTags: any): string[] {
  if (!rawTags || typeof rawTags !== "string") return [];
  return rawTags
    .split(";")
    .map((t: string) => t.trim().toLowerCase())
    .filter(Boolean);
}

/** Extract projects from the `project` text field (semicolon-separated). */
function extractProjects(raw: any): string[] {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(";")
    .map((p: string) => p.trim())
    .filter(Boolean);
}

/**
 * List all published tesselas, with optional filtering by tag, status, or project.
 */
export async function listTesselas(options?: {
  tag?: string;
  stage?: string;
  project: string[];
}): Promise<TesselaListItem[]> {
  const payload = await getPayload({ config: configPromise });

  const where: Record<string, any> = {
    _status: { equals: "published" },
  };
  if (options?.stage) where["stage"] = { equals: options.stage };
  if (options?.project) where["project"] = { contains: options.project };
  // Tag filtering: text field contains the tag
  if (options?.tag) where["tags"] = { contains: options.tag };

  const result = await payload.find({
    collection: "tesselas",
    where,
    sort: "-publishedAt",
    limit: 500,
    depth: 1,
  });

  return result.docs.map((doc: any) => ({
    id: doc.id,
    slug: doc.slug,
    title: doc.title,
    abstract: doc.abstract || undefined,
    stage: doc.stage,
    tags: extractTags(doc.tags),
    project: extractProjects(doc.project),
    publishedAt: doc.publishedAt || undefined,
    updatedAt: doc.updatedAt || undefined,
    coverImage: doc.coverImage
      ? { url: doc.coverImage.url, alt: doc.coverImage.alt || undefined }
      : null,
  }));
}

/**
 * Get a single tessela by slug, with all relationships populated.
 * Pass `draft = true` to fetch unpublished drafts (admin preview only).
 */
export async function getTessela(
  slug: string,
  draft: boolean = false,
): Promise<TesselaDetail | null> {
  const payload = await getPayload({ config: configPromise });
  const decodedSlug = decodeURIComponent(slug);

  const result = await payload.find({
    collection: "tesselas",
    where: { slug: { equals: decodedSlug } },
    limit: 1,
    depth: 2, // depth 2 to populate relatedModules → course
    draft,
  });

  const doc = result.docs[0] as any;
  if (!doc) return null;

  // For non-admin requests, require published status
  if (!draft && doc._status !== "published") return null;

  // --- relatedDisciplinas ---
  const relatedDisciplinas = Array.isArray(doc.relatedDisciplinas)
    ? doc.relatedDisciplinas
        .filter((d: any) => d && typeof d === "object")
        .map((d: any) => ({
          id: d.id,
          slug: d.slug,
          title: d.title,
          code: d.code,
        }))
    : [];

  // --- relatedModules ---
  const relatedModules = Array.isArray(doc.relatedModules)
    ? doc.relatedModules
        .filter((m: any) => m && typeof m === "object")
        .map((m: any) => ({
          id: m.id,
          slug: m.slug,
          title: m.title,
          courseSlug:
            m.course && typeof m.course === "object" ? m.course.slug : "",
        }))
    : [];

  // --- relatedTesselas (outgoing) ---
  const relatedTesselas: TesselaRelatedItem[] = Array.isArray(
    doc.relatedTesselas,
  )
    ? doc.relatedTesselas
        .filter((c: any) => c && typeof c === "object")
        .map((c: any) => ({
          id: c.id,
          slug: c.slug,
          title: c.title,
          abstract: c.abstract || undefined,
          tags: extractTags(c.tags),
          stage: c.stage,
        }))
    : [];

  // --- referencedBy (incoming) — second query ---
  const incomingResult = await payload.find({
    collection: "tesselas",
    where: {
      relatedTesselas: { contains: doc.id },
      _status: { equals: "published" },
    },
    limit: 100,
    depth: 0,
    draft: false,
  });

  const referencedBy: TesselaRelatedItem[] = incomingResult.docs.map(
    (c: any) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      abstract: c.abstract || undefined,
      tags: extractTags(c.tags),
      stage: c.stage,
    }),
  );

  return {
    id: doc.id,
    slug: doc.slug,
    title: doc.title,
    abstract: doc.abstract || undefined,
    stage: doc.stage,
    tags: extractTags(doc.tags),
    project: extractProjects(doc.project),
    publishedAt: doc.publishedAt || undefined,
    updatedAt: doc.updatedAt || undefined,
    coverImage: doc.coverImage
      ? { url: doc.coverImage.url, alt: doc.coverImage.alt || undefined }
      : null,
    content: doc.content || undefined,
    citationStyle: doc.citationStyle || undefined,
    relatedDisciplinas,
    relatedModules,
    relatedTesselas,
    referencedBy,
  };
}

/**
 * Lightweight query for the graph visualization.
 * Returns only fields needed to build nodes and directed edges.
 */
export async function listAllTesselasForGraph(): Promise<
  {
    id: string;
    slug: string;
    title: string;
    tags: string[];
    project: string[];
    stage: string;
    coverImage?: { url: string; alt?: string } | null;
    relatedTesselas: { id: string }[];
  }[]
> {
  const payload = await getPayload({ config: configPromise });

  const result = await payload.find({
    collection: "tesselas",
    where: { _status: { equals: "published" } },
    limit: 1000,
    depth: 1, // depth 1 to get relatedTesselas ids
    sort: "-publishedAt",
  });

  return result.docs.map((doc: any) => ({
    id: doc.id,
    slug: doc.slug,
    title: doc.title,
    tags: extractTags(doc.tags),
    project: extractProjects(doc.project),
    stage: doc.stage,
    coverImage: doc.coverImage
      ? { url: doc.coverImage.url, alt: doc.coverImage.alt || undefined }
      : null,
    relatedTesselas: Array.isArray(doc.relatedTesselas)
      ? doc.relatedTesselas
          .filter((c: any) => c && (typeof c === "string" || typeof c === "object"))
          .map((c: any) => ({ id: typeof c === "object" ? c.id : c }))
      : [],
  }));
}
