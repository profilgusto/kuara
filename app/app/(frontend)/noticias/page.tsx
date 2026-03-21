import Link from "next/link";
import { getPosts } from "@/lib/payload-content";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const dynamic = "force-dynamic";

export default async function NoticiasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = params.page ? parseInt(params.page, 10) : 1;
  const { docs: posts, totalPages } = await getPosts(page, 12);

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <header className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
          Notícias
        </h1>
        <p className="text-lg text-muted-foreground">
          Acompanhe as últimas novidades, anúncios e eventos da Biofloresta.
        </p>
      </header>

      {posts.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/noticias/${post.slug}`}
              className="group h-full"
            >
              <Card className="h-full hover:border-primary/50 transition-colors flex flex-col">
                <CardHeader>
                  <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors">
                    {post.title}
                  </CardTitle>
                  <CardDescription>
                    {post.publishedAt
                      ? format(
                          new Date(post.publishedAt),
                          "d 'de' MMMM, yyyy",
                          { locale: ptBR },
                        )
                      : "Data não informada"}
                  </CardDescription>
                </CardHeader>
                {/* No excerpt field added yet, but we could strip tags from rich text if needed */}
                <CardContent className="flex-1" />
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-24 bg-muted/10 rounded-2xl border border-dashed">
          <p className="text-muted-foreground">
            Nenhuma notícia publicada ainda.
          </p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center mt-12 gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/noticias?page=${p}`}
              className={`px-4 py-2 rounded-md transition-colors ${
                p === page
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
