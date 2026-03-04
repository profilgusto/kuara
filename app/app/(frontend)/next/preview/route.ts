import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function GET(
    req: Request,
): Promise<Response> {
    const payload = await getPayload({ config: configPromise })
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const collection = searchParams.get('collection')

    if (!id || !collection) {
        return new Response('No id or collection provided', { status: 404 })
    }

    // Verify the user is logged in
    const { user } = await payload.auth({ headers: req.headers as any })
    if (!user) {
        return new Response('Unauthorized', { status: 401 })
    }

    if (collection === 'modules') {
        const moduleDoc = await payload.findByID({
            collection: 'modules',
            id,
            depth: 1,
            draft: true,
        })
        if (!moduleDoc) {
            return new Response('Module not found', { status: 404 })
        }

        const draft = await draftMode()
        draft.enable()

        const courseSlug = typeof moduleDoc.course === 'object' ? moduleDoc.course.slug : 'unknown'
        redirect(`/disciplinas/${courseSlug}/${moduleDoc.slug}`)
    }

    return new Response('Unsupported collection', { status: 400 })
}
