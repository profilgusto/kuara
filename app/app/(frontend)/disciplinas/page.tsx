import Link from "next/link";
import Image from "next/image";
import { listCourses } from "@/lib/payload-content";
import { BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DisciplinasPage() {
  const courses = await listCourses();

  return (
    <main className="container mx-auto px-4 py-8 space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Disciplinas</h1>
        <p className="text-muted-foreground mt-1">
          Conteúdos das disciplinas disponíveis
        </p>
      </header>

      {courses.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Nenhuma disciplina cadastrada.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre uma disciplina no{" "}
            <Link href="/admin" className="underline">
              painel admin
            </Link>
            .
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => (
          <Link
            key={c.slug}
            href={`/disciplinas/${c.slug}`}
            className="group relative block rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md"
          >
            {c.coverImage ? (
              <>
                <Image
                  src={c.coverImage}
                  alt={c.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
                {/* Dark blur mask — same style as SlideCover */}
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.55)",
                    backdropFilter: "blur(3px)",
                    WebkitBackdropFilter: "blur(3px)",
                  }}
                />
                <div className="relative z-10 p-6 space-y-2 min-h-[160px] flex flex-col justify-end">
                  <span className="text-[10px] uppercase tracking-wider text-white/70 font-medium">
                    {c.code}
                  </span>
                  <h2 className="font-semibold text-lg leading-snug text-white drop-shadow">
                    {c.title}
                  </h2>
                  {c.summary && (
                    <p className="text-sm text-white/80 line-clamp-3 drop-shadow">
                      {c.summary}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="border bg-card p-6 rounded-xl h-full transition-all group-hover:border-primary/30 space-y-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  {c.code}
                </span>
                <h2 className="font-semibold text-lg leading-snug group-hover:text-primary transition-colors">
                  {c.title}
                </h2>
                {c.summary && (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {c.summary}
                  </p>
                )}
              </div>
            )}
          </Link>
        ))}
      </div>
    </main>
  );
}
