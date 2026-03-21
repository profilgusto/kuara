import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/payload-professor";
import { getPayload } from "payload";
import configPromise from "@payload-config";
import { GraduationCap, BookOpen, Calendar, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AlunoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/aluno");

  const payload = await getPayload({ config: configPromise });

  // Find offers where this student is enrolled
  const offersResult = await payload.find({
    collection: "offers",
    where: {
      students: { contains: user.id },
    },
    depth: 1, // populate course
    limit: 100,
    sort: "-createdAt",
  });

  const activeOffers = offersResult.docs.filter(
    (o: any) => o.status === "active",
  );
  const archivedOffers = offersResult.docs.filter(
    (o: any) => o.status === "archived",
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-amber-500/10 p-2 rounded-lg">
            <GraduationCap className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Área do Aluno
            </h1>
            <p className="text-sm text-muted-foreground">
              Bem-vindo(a), {user.name}!
            </p>
          </div>
        </div>
      </header>

      {/* Active Enrollments */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
          Disciplinas Ativas ({activeOffers.length})
        </h2>

        {activeOffers.length === 0 ? (
          <div className="text-center py-12 bg-muted/10 rounded-xl border border-dashed">
            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">
              Você não está matriculado(a) em nenhuma oferta ativa.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {activeOffers.map((offer: any) => (
              <StudentOfferCard key={offer.id} offer={offer} />
            ))}
          </div>
        )}
      </section>

      {/* Archived */}
      {archivedOffers.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-gray-400 inline-block" />
            Histórico ({archivedOffers.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {archivedOffers.map((offer: any) => (
              <StudentOfferCard key={offer.id} offer={offer} archived />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StudentOfferCard({
  offer,
  archived = false,
}: {
  offer: any;
  archived?: boolean;
}) {
  const courseTitle =
    typeof offer.course === "object" ? offer.course.title : "Disciplina";
  const courseCode = typeof offer.course === "object" ? offer.course.code : "";

  return (
    <Link
      href={`/aluno/ofertas/${offer.id}`}
      className={`group block rounded-xl border p-5 transition-all hover:shadow-md hover:border-primary/30 ${
        archived ? "opacity-60 hover:opacity-80" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            {courseCode}
          </p>
          <h3 className="font-semibold text-base leading-snug group-hover:text-primary transition-colors truncate">
            {courseTitle}
          </h3>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0 group-hover:text-primary transition-colors" />
      </div>
      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {offer.period}
        </span>
      </div>
    </Link>
  );
}
