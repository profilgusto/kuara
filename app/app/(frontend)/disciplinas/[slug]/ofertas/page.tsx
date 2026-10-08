import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCourse } from "@/lib/payload-content";
import { getSessionUser } from "@/lib/server-session";
import {
  getCourseOffers,
  getOfferAssessments,
  getOfferEnrollments,
  getOfferGroups,
  getOfferScores,
} from "@/lib/payload-offers";
import { pickActiveOffer } from "@/lib/offer-period";
import { CourseHeader } from "@/components/disciplinas/CourseHeader";
import { OfferToolbar } from "@/components/disciplinas/OfferToolbar";
import { EnrollmentTable } from "@/components/disciplinas/EnrollmentTable";
import { AssessmentTable } from "@/components/disciplinas/AssessmentTable";
import { SetNavBreadcrumb } from "@/components/layout/NavContext";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourse(slug);
  return {
    title: course ? `Ofertas — ${course.title} | Kuara` : "Ofertas | Kuara",
    // Admin-only page: nothing here for a search engine.
    robots: { index: false, follow: false },
  };
}

/**
 * Offers of a course — admin only. The course header (shared with the course
 * page), then a toolbar choosing which offer is on screen: `?oferta=2026.2`,
 * or the most recent one when the address names none. Under it, the students
 * enrolled in that offer and its assessments.
 *
 * Anyone else gets a 404 rather than a redirect, so the page does not reveal
 * itself to visitors.
 */
export default async function CourseOffersPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ oferta?: string | string[] }>;
}) {
  const { slug } = await params;
  const { oferta } = await searchParams;
  const user = await getSessionUser();
  if (user?.role !== "admin") notFound();

  const course = await getCourse(slug);
  if (!course) notFound();

  const offers = await getCourseOffers(course.id);
  const activeOffer = pickActiveOffer(
    offers,
    typeof oferta === "string" ? oferta : null,
  );

  const [enrollments, assessments, groups, scores] = activeOffer
    ? await Promise.all([
        getOfferEnrollments(activeOffer.id),
        getOfferAssessments(activeOffer.id),
        getOfferGroups(activeOffer.id),
        getOfferScores(activeOffer.id),
      ])
    : [[], [], [], []];

  return (
    <main className="container mx-auto px-4 py-8 space-y-8">
      <SetNavBreadcrumb
        items={[{ label: "Disciplinas", href: "/disciplinas" }]}
      />
      <div className="space-y-5">
        <CourseHeader
          course={{
            id: course.id,
            title: course.title,
            code: course.code,
            summary: course.summary,
            workload: course.workload,
          }}
          sectionLink={{ label: "Módulos", href: `/disciplinas/${slug}` }}
          // The course itself is edited on its own page, not here.
          editable={false}
        />

        <OfferToolbar
          courseId={course.id}
          offers={offers}
          activePeriod={activeOffer?.period ?? null}
        />
      </div>

      {activeOffer && (
        <>
          <EnrollmentTable
            // A fresh table per offer: search and sorting do not carry over.
            key={`enrollments-${activeOffer.id}`}
            offerId={activeOffer.id}
            offerPeriod={activeOffer.period}
            enrollments={enrollments}
            groups={groups}
            assessments={assessments}
            scores={scores}
          />
          <AssessmentTable
            key={`assessments-${activeOffer.id}`}
            offerId={activeOffer.id}
            assessments={assessments}
          />
        </>
      )}
    </main>
  );
}
