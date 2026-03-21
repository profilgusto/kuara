/**
 * lib/payload-professor.ts
 *
 * Data access layer for professor management pages (/gestao).
 * Fetches offers, activities, groups, and scores scoped to the professor.
 */
import { getPayload } from "payload";
import configPromise from "@payload-config";
import { headers } from "next/headers";

/**
 * Get the currently authenticated user from the Payload JWT cookie.
 */
export async function getCurrentUser() {
  const payload = await getPayload({ config: configPromise });
  const headersList = await headers();
  const { user } = await payload.auth({ headers: headersList });
  return user || null;
}

/**
 * List all offers for a professor (or all for admin).
 */
export async function listProfessorOffers(userId: string, role: string) {
  const payload = await getPayload({ config: configPromise });

  const where: any =
    role === "admin"
      ? {} // Admin sees all
      : { instructor: { equals: userId } };

  const result = await payload.find({
    collection: "offers",
    where,
    sort: "-createdAt",
    limit: 100,
    depth: 1, // populate course and instructor
  });

  return result.docs;
}

/**
 * Get a single offer with populated relationships.
 */
export async function getOffer(offerId: string) {
  const payload = await getPayload({ config: configPromise });
  try {
    const offer = await payload.findByID({
      collection: "offers",
      id: offerId,
      depth: 2, // populate course -> modules, students, etc.
    });
    return offer;
  } catch {
    return null;
  }
}

/**
 * Get activities for an offer, sorted by order.
 */
export async function getOfferActivities(offerId: string) {
  const payload = await getPayload({ config: configPromise });
  const result = await payload.find({
    collection: "activities",
    where: { offer: { equals: offerId } },
    sort: "order",
    limit: 50,
  });
  return result.docs;
}

/**
 * Get student groups for an offer.
 */
export async function getOfferGroups(offerId: string) {
  const payload = await getPayload({ config: configPromise });
  const result = await payload.find({
    collection: "student-groups",
    where: { offer: { equals: offerId } },
    sort: "name",
    limit: 50,
    depth: 1, // populate students
  });
  return result.docs;
}

/**
 * Get all scores for an offer.
 */
export async function getOfferScores(offerId: string) {
  const payload = await getPayload({ config: configPromise });
  const result = await payload.find({
    collection: "scores",
    where: { offer: { equals: offerId } },
    limit: 1000, // generous limit for a class
    depth: 1,
  });
  return result.docs;
}

/**
 * Get modules for a course (used to set currentModule).
 */
export async function getCourseModules(courseId: string) {
  const payload = await getPayload({ config: configPromise });
  const result = await payload.find({
    collection: "modules",
    where: {
      course: { equals: courseId },
      visible: { equals: true },
    },
    sort: "order",
    limit: 100,
  });
  return result.docs;
}

/**
 * Get offer-scoped posts.
 */
export async function getOfferPosts(offerId: string) {
  const payload = await getPayload({ config: configPromise });
  const result = await payload.find({
    collection: "posts",
    where: {
      offer: { equals: offerId },
      status: { equals: "published" },
    },
    sort: "-publishedAt",
    limit: 50,
  });
  return result.docs;
}
