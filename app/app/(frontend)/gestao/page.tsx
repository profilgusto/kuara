import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, listProfessorOffers } from "@/lib/payload-professor";
import {
  BookOpen,
  GraduationCap,
  Calendar,
  Users,
  ChevronRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function GestaoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/gestao");
  if (user.role !== "admin" && user.role !== "professor") redirect("/aluno");

  const offers = await listProfessorOffers(user.id, user.role);

  const activeOffers = offers.filter((o: any) => o.status === "active");
  const archivedOffers = offers.filter((o: any) => o.status === "archived");

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-primary/10 p-2 rounded-lg">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Gestão de Ofertas
            </h1>
            <p className="text-sm text-muted-foreground">
              Olá, {user.name}. Gerencie suas disciplinas abaixo.
            </p>
          </div>
        </div>
      </header>

      {/* Active Offers */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
          Ofertas Ativas ({activeOffers.length})
        </h2>

        {activeOffers.length === 0 ? (
          <div className="text-center py-12 bg-muted/10 rounded-xl border border-dashed">
            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">
              Nenhuma oferta ativa.{" "}
              <Link
                href="/admin/collections/offers/create"
                className="underline text-primary"
              >
                Criar no admin
              </Link>
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {activeOffers.map((offer: any) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </div>
        )}
      </section>

      {/* Archived Offers */}
      {archivedOffers.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-gray-400 inline-block" />
            Ofertas Arquivadas ({archivedOffers.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {archivedOffers.map((offer: any) => (
              <OfferCard key={offer.id} offer={offer} archived />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function OfferCard({
  offer,
  archived = false,
}: {
  offer: any;
  archived?: boolean;
}) {
  const courseTitle =
    typeof offer.course === "object" ? offer.course.title : "Disciplina";
  const courseCode = typeof offer.course === "object" ? offer.course.code : "";
  const studentCount = Array.isArray(offer.students)
    ? offer.students.length
    : 0;

  return (
    <Link
      href={`/gestao/ofertas/${offer.id}`}
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

      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {offer.period}
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {studentCount} aluno{studentCount !== 1 ? "s" : ""}
        </span>
      </div>
    </Link>
  );
}
