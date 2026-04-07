import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  getCurrentUser,
  getOffer,
  getOfferActivities,
  getOfferScores,
  getOfferGroups,
} from "@/lib/payload-professor";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { GradingClient } from "./GradingClient";

export const dynamic = "force-dynamic";

export default async function NotasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/gestao");
  if (user.role !== "admin" && user.role !== "professor") redirect("/aluno");

  const offer = await getOffer(id, user);
  if (!offer) notFound();

  const courseTitle =
    typeof offer.course === "object" ? offer.course.title : "Disciplina";

  const [activities, scores, groups] = await Promise.all([
    getOfferActivities(id),
    getOfferScores(id),
    getOfferGroups(id),
  ]);

  const students = Array.isArray(offer.students)
    ? offer.students.map((s: any) =>
        typeof s === "object"
          ? { id: s.id, name: s.name || s.email || "Aluno" }
          : { id: s, name: "Aluno" },
      )
    : [];

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <nav className="mb-6">
        <Link
          href={`/gestao/ofertas/${id}`}
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {courseTitle} — {offer.period}
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl flex items-center gap-3">
          <ClipboardList className="h-7 w-7 text-primary" />
          Notas & Atividades
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure atividades, pesos e lance notas dos alunos.
        </p>
      </header>

      <GradingClient
        offerId={id}
        initialActivities={activities.map((a: any) => ({
          id: a.id,
          acronym: a.acronym,
          description: a.description,
          weight: a.weight,
          type: a.type,
          order: a.order || 0,
        }))}
        initialScores={scores.map((s: any) => ({
          id: s.id,
          activityId:
            typeof s.activity === "object" ? s.activity.id : s.activity,
          entityType: s.entityType,
          studentId: typeof s.student === "object" ? s.student?.id : s.student,
          groupId: typeof s.group === "object" ? s.group?.id : s.group,
          percentage: s.percentage,
        }))}
        students={students}
        groups={groups.map((g: any) => ({
          id: g.id,
          name: g.name,
          studentIds: Array.isArray(g.students)
            ? g.students.map((s: any) => (typeof s === "object" ? s.id : s))
            : [],
        }))}
      />
    </div>
  );
}
