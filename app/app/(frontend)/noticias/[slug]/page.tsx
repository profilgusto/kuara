import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPost } from '@/lib/payload-content'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowLeft, Calendar } from 'lucide-react'
import { RichText } from '@payloadcms/richtext-lexical/react'

export const dynamic = 'force-dynamic'

export default async function PostPage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params
    const post = await getPost(slug)

    if (!post) notFound()

    return (
        <article className="container mx-auto px-4 py-12 max-w-3xl">
            <nav className="mb-8">
                <Link
                    href="/noticias"
                    className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar para Notícias
                </Link>
            </nav>

            <header className="mb-10 text-center">
                <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl mb-6">
                    {post.title}
                </h1>
                <div className="flex items-center justify-center text-muted-foreground text-sm space-x-2">
                    <Calendar className="h-4 w-4" />
                    <time dateTime={post.publishedAt || post.createdAt}>
                        {post.publishedAt
                            ? format(new Date(post.publishedAt), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
                            : format(new Date(post.createdAt), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </time>
                </div>
            </header>

            <div className="prose prose-neutral dark:prose-invert md:prose-lg max-w-none mx-auto">
                {post.body && <RichText data={post.body} />}
            </div>
        </article>
    )
}
