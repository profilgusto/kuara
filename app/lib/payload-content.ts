/**
 * lib/payload-content.ts
 *
 * Data access layer for Telaclass pages.
 * Replaces the old filesystem-based content.ts with Payload CMS API calls.
 */
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export type ModuleType = 'modulo-teorico' | 'modulo-pratico' | 'atividade-avaliativa' | 'recurso'

export interface CourseListItem {
    slug: string
    title: string
    code: string
    summary?: string
}

export interface CourseModule {
    id: string
    title: string
    slug: string
    type: ModuleType
    order: number
    visible: boolean
    content?: string
    /** Auto-assigned number within its type group (teórico: 1,2,3...; prático: 1,2,3...) */
    number?: number | null
}

export interface CourseDetail {
    id: string
    code: string
    title: string
    slug: string
    summary?: string
    workload?: { theoretical?: number; practical?: number }
    modules: CourseModule[]
}

/**
 * List all courses (for /disciplinas index page).
 */
export async function listCourses(): Promise<CourseListItem[]> {
    const payload = await getPayload({ config: configPromise })
    const result = await payload.find({
        collection: 'courses',
        limit: 100,
        sort: 'title',
    })

    return result.docs.map((doc: any) => ({
        slug: doc.slug,
        title: doc.title,
        code: doc.code,
        summary: doc.summary || undefined,
    }))
}

/**
 * Get a single course by slug, with all its visible modules.
 */
export async function getCourse(slug: string): Promise<CourseDetail | null> {
    const payload = await getPayload({ config: configPromise })
    const courseResult = await payload.find({
        collection: 'courses',
        where: { slug: { equals: slug } },
        limit: 1,
    })

    const course = courseResult.docs[0] as any
    if (!course) return null

    // Fetch modules for this course
    const modulesResult = await payload.find({
        collection: 'modules',
        where: {
            course: { equals: course.id },
            visible: { equals: true },
        },
        sort: 'order',
        limit: 100,
    })

    // Auto-assign numbers by type (teórico: 1,2,3...; prático: 1,2,3...)
    let teoricoCounter = 1
    let praticoCounter = 1

    const modules: CourseModule[] = modulesResult.docs.map((m: any) => ({
        id: m.id,
        title: m.title,
        slug: m.slug,
        type: m.type as ModuleType,
        order: m.order,
        visible: m.visible,
        content: m.content || undefined,
        number:
            m.type === 'modulo-teorico'
                ? teoricoCounter++
                : m.type === 'modulo-pratico'
                    ? praticoCounter++
                    : null,
    }))

    return {
        id: course.id,
        code: course.code,
        title: course.title,
        slug: course.slug,
        summary: course.summary || undefined,
        workload: course.workload || undefined,
        modules,
    }
}

/**
 * Get a specific module's content by course slug + module slug.
 */
export async function getModule(
    courseSlug: string,
    moduleSlug: string
): Promise<{ module: CourseModule; courseTitle: string; courseSlug: string } | null> {
    const payload = await getPayload({ config: configPromise })

    // Find the course first
    const courseResult = await payload.find({
        collection: 'courses',
        where: { slug: { equals: courseSlug } },
        limit: 1,
    })
    const course = courseResult.docs[0] as any
    if (!course) return null

    // Find the module
    const moduleResult = await payload.find({
        collection: 'modules',
        where: {
            course: { equals: course.id },
            slug: { equals: moduleSlug },
        },
        limit: 1,
    })
    const mod = moduleResult.docs[0] as any
    if (!mod) return null

    return {
        module: {
            id: mod.id,
            title: mod.title,
            slug: mod.slug,
            type: mod.type as ModuleType,
            order: mod.order,
            visible: mod.visible,
            content: mod.content || undefined,
            number: null, // not needed on detail page
        },
        courseTitle: course.title,
        courseSlug: course.slug,
    }
}
