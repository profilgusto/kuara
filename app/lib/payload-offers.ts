/**
 * lib/payload-offers.ts — reads a course's offers, and the students enrolled
 * in one, for the offers page.
 *
 * Uses Payload's local API, which does not apply the collection's access
 * rules on its own: callers check who is signed in first
 * (lib/server-session.ts).
 */
import { getPayload } from "payload";
import configPromise from "@payload-config";
import { sortOffersLatestFirst, type OfferOption } from "./offer-period";
import type { ScoreRow } from "./grades";
import {
  parseClassGroup,
  type EnrollmentRow,
  type StudentGroupOption,
} from "./enrollment";
import { assessmentFromActivity, type AssessmentRow } from "./assessment";

/** Every offer of a course, most recent period first. */
export async function getCourseOffers(
  courseId: string | number,
): Promise<OfferOption[]> {
  const payload = await getPayload({ config: configPromise });
  const result = await payload.find({
    collection: "offers",
    where: { course: { equals: courseId } },
    depth: 0,
    limit: 200,
  });
  return sortOffersLatestFirst(
    result.docs.map((doc) => ({
      id: doc.id,
      period: doc.period,
      status: doc.status,
    })),
  );
}

/** Every student enrolled in an offer. The table does its own ordering. */
export async function getOfferEnrollments(
  offerId: string | number,
): Promise<EnrollmentRow[]> {
  const payload = await getPayload({ config: configPromise });
  const result = await payload.find({
    collection: "enrollments",
    where: { offer: { equals: offerId } },
    depth: 0,
    pagination: false,
    sort: "name",
  });
  return result.docs.map((doc) => ({
    id: doc.id,
    registration: doc.registration,
    name: doc.name,
    classGroup: parseClassGroup(doc.classGroup),
    // depth 0: the relationship arrives as the bare id.
    groupId:
      typeof doc.group === "object" && doc.group !== null
        ? doc.group.id
        : (doc.group ?? null),
  }));
}

/** The assessments of an offer, in the order they were set up. */
export async function getOfferAssessments(
  offerId: string | number,
): Promise<AssessmentRow[]> {
  const payload = await getPayload({ config: configPromise });
  const result = await payload.find({
    collection: "activities",
    where: { offer: { equals: offerId } },
    depth: 0,
    pagination: false,
    sort: ["order", "createdAt"],
  });
  return result.docs.map(assessmentFromActivity);
}

/** The work groups of an offer. The table does its own ordering. */
export async function getOfferGroups(
  offerId: string | number,
): Promise<StudentGroupOption[]> {
  const payload = await getPayload({ config: configPromise });
  const result = await payload.find({
    collection: "student-groups",
    where: { offer: { equals: offerId } },
    depth: 0,
    pagination: false,
    sort: "name",
  });
  return result.docs.map((doc) => ({ id: doc.id, name: doc.name }));
}

const idOf = (value: unknown): string | number | null =>
  typeof value === "object" && value !== null
    ? ((value as { id?: string | number }).id ?? null)
    : ((value as string | number | null | undefined) ?? null);

/** Every grade given to the students of an offer. */
export async function getOfferScores(
  offerId: string | number,
): Promise<ScoreRow[]> {
  const payload = await getPayload({ config: configPromise });
  const result = await payload.find({
    collection: "scores",
    where: { offer: { equals: offerId } },
    depth: 0,
    pagination: false,
  });
  return result.docs.flatMap((doc) => {
    const assessmentId = idOf(doc.activity);
    // A grade belongs to an enrolled student; anything else is not shown.
    if (assessmentId === null || idOf(doc.enrollment) === null) return [];
    return [
      {
        id: doc.id,
        assessmentId,
        enrollmentId: idOf(doc.enrollment),
        percentage: doc.percentage,
        completedTaskIds: Array.isArray(doc.completedTasks)
          ? doc.completedTasks.map(String)
          : [],
      },
    ];
  });
}
