import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  getCurrentUser,
  getOffer,
  getOfferGroups,
} from "@/lib/payload-professor";
import { ArrowLeft, Users } from "lucide-react";
import { GroupBuilderClient } from "./GroupBuilderClient";

export const dynamic = "force-dynamic";

export default async function GroupsPage({
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

  const groups = await getOfferGroups(id);

  const courseTitle =
    typeof offer.course === "object" ? offer.course.title : "Disciplina";

  // Build student list — enrolled students not in any group
  const allStudents = Array.isArray(offer.students)
    ? offer.students.map((s: any) =>
        typeof s === "object"
          ? { id: s.id, name: s.name || s.email || "Aluno" }
          : { id: s, name: "Aluno" },
      )
    : [];

  const assignedStudentIds = new Set<string>();
  const groupsData = groups.map((g: any) => {
    const members = Array.isArray(g.students)
      ? g.students.map((s: any) => {
          const student = typeof s === "object" ? s : { id: s, name: "Aluno" };
          assignedStudentIds.add(student.id);
          return {
            id: student.id,
            name: student.name || student.email || "Aluno",
          };
        })
      : [];
    return { id: g.id, name: g.name, students: members };
  });

  const unassignedStudents = allStudents.filter(
    (s: any) => !assignedStudentIds.has(s.id),
  );

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
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
          <Users className="h-7 w-7 text-primary" />
          Gerenciar Grupos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Arraste alunos da lista para os grupos. Crie, renomeie ou remova
          grupos livremente.
        </p>
      </header>

      <GroupBuilderClient
        offerId={id}
        initialUnassigned={unassignedStudents}
        initialGroups={groupsData}
      />
    </div>
  );
}
