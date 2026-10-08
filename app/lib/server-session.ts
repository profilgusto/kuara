/**
 * lib/server-session.ts — who is signed in, read on the server.
 *
 * For pages that must not render at all for the wrong visitor. Calling it
 * makes the page dynamic (it reads the request's cookies), so public pages
 * keep using the client-side SessionContext instead.
 */
import { headers } from "next/headers";
import { getPayload } from "payload";
import configPromise from "@payload-config";

export async function getSessionUser() {
  const payload = await getPayload({ config: configPromise });
  const { user } = await payload.auth({ headers: await headers() });
  return user ?? null;
}
