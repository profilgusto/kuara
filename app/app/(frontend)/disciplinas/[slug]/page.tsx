import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCourse } from "@/lib/payload-content";
import { BookOpen } from "lucide-react";
import { CourseModuleList } from "@/components/disciplinas/CourseModuleList";
import { SetNavBreadcrumb } from "@/components/layout/NavContext";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourse(slug);
  if (!course) return {};

  const description =
    course.summary ??
    `Disciplina ${course.code} disponível na plataforma Kuara.`;

  return {
    title: `${course.title} | Kuara`,
    description,
    openGraph: {
      title: course.title,
      description,
      type: "website",
    },
  };
}

export default async function CourseHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await getCourse(slug);
  if (!course) notFound();

  return (
    <main className="container mx-auto px-4 py-8 space-y-8">
      <SetNavBreadcrumb
        items={[{ label: "Disciplinas", href: "/disciplinas" }]}
      />
      {/* Course header */}
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{course.title}</h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="font-mono">{course.code}</span>
          {course.workload && (
            <span>
              {course.workload.theoretical &&
                `${course.workload.theoretical}h teórica`}
              {course.workload.theoretical &&
                course.workload.practical &&
                " · "}
              {course.workload.practical &&
                `${course.workload.practical}h prática`}
            </span>
          )}
        </div>
        {course.summary && (
          <p className="text-muted-foreground max-w-2xl">{course.summary}</p>
        )}
      </header>

      {course.modules.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Nenhum módulo cadastrado para esta disciplina.
          </p>
        </div>
      ) : (
        <CourseModuleList modules={course.modules} courseSlug={slug} />
      )}
    </main>
  );
}
