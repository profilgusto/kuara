import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCourse } from "@/lib/payload-content";
import { CourseHeader } from "@/components/disciplinas/CourseHeader";
import { CourseAssessments } from "@/components/disciplinas/CourseAssessments";
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
      <CourseHeader
        course={{
          id: course.id,
          title: course.title,
          code: course.code,
          summary: course.summary,
          workload: course.workload,
        }}
        sectionLink={{
          label: "Ofertas",
          href: `/disciplinas/${slug}/ofertas`,
          adminOnly: true,
        }}
      />

      <CourseAssessments courseId={course.id} />

      <CourseModuleList
        modules={course.modules}
        courseSlug={slug}
        courseId={course.id}
      />
    </main>
  );
}
