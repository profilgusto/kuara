import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPayload } from "payload";
import configPromise from "@payload-config";
import { getSessionUser } from "@/lib/server-session";
import { sortOffersLatestFirst } from "@/lib/offer-period";
import { SetNavBreadcrumb } from "@/components/layout/NavContext";
import { TermsSettings } from "./TermsSettings";

// Reads the session and the database: never prerender at build time, when
// there is no database to initialise Payload against.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Configurações gerais | Kuara",
  // Admin-only page: nothing here for a search engine.
  robots: { index: false, follow: false },
};

/**
 * /configuracoes — platform-wide options, admin only. Anyone else gets a 404
 * rather than a redirect, so the page does not reveal itself.
 */
export default async function SettingsPage() {
  const user = await getSessionUser();
  if (user?.role !== "admin") notFound();

  const payload = await getPayload({ config: configPromise });
  const [terms, settings] = await Promise.all([
    payload.find({
      collection: "terms",
      depth: 0,
      pagination: false,
      overrideAccess: true,
    }),
    payload.findGlobal({ slug: "site-settings", depth: 0 }),
  ]);
  const activeTerm = settings.activeTerm;

  return (
    <main className="container mx-auto max-w-2xl px-4 py-12">
      <SetNavBreadcrumb items={[]} />
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Configurações gerais
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Opções que valem para todas as disciplinas do Kuara.
        </p>
      </header>
      <TermsSettings
        terms={sortOffersLatestFirst(
          terms.docs.map((t) => ({ id: t.id, period: t.period })),
        )}
        activeTermId={
          typeof activeTerm === "object" && activeTerm !== null
            ? activeTerm.id
            : (activeTerm ?? null)
        }
      />
    </main>
  );
}
