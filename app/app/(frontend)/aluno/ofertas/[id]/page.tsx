import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  getCurrentUser,
  getOffer,
  getOfferActivities,
  getOfferScores,
  getOfferGroups,
  getOfferPosts,
} from "@/lib/payload-professor";
import {
  ArrowLeft,
  BookOpen,
  ClipboardList,
  Megaphone,
  Calendar,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StudentOfferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/aluno");

  const offer = await getOffer(id);
  if (!offer) notFound();

  // Check enrollment
  const isEnrolled =
    Array.isArray(offer.students) &&
    offer.students.some(
      (s: any) => (typeof s === "object" ? s.id : s) === user.id,
    );
  if (!isEnrolled && user.role === "student") notFound();

  const courseTitle =
    typeof offer.course === "object" ? offer.course.title : "Disciplina";
  const courseCode = typeof offer.course === "object" ? offer.course.code : "";
  const courseSlug = typeof offer.course === "object" ? offer.course.slug : "";

  const [activities, scores, groups, posts] = await Promise.all([
    getOfferActivities(id),
    getOfferScores(id),
    getOfferGroups(id),
    getOfferPosts(id),
  ]);

  // Find student's group
  const studentGroup = groups.find((g: any) => {
    const members = Array.isArray(g.students) ? g.students : [];
    return members.some(
      (s: any) => (typeof s === "object" ? s.id : s) === user.id,
    );
  });

  // Compute student scores for each activity
  function getStudentScore(actId: string, actType: string): number | null {
    // Individual override first
    const individual: any = scores.find(
      (s: any) =>
        (typeof s.activity === "object" ? s.activity.id : s.activity) ===
          actId &&
        s.entityType === "student" &&
        (typeof s.student === "object" ? s.student?.id : s.student) ===
          user!.id,
    );
    if (individual) return individual.percentage;

    // Group score
    if (actType === "group" && studentGroup) {
      const groupScore: any = scores.find(
        (s: any) =>
          (typeof s.activity === "object" ? s.activity.id : s.activity) ===
            actId &&
          s.entityType === "group" &&
          (typeof s.group === "object" ? s.group?.id : s.group) ===
            studentGroup.id,
      );
      if (groupScore) return groupScore.percentage;
    }

    return null;
  }

  const totalWeight = activities.reduce(
    (s: number, a: any) => s + (a.weight || 0),
    0,
  );
  const weightValid = Math.abs(totalWeight - 10) < 0.01;

  let finalScore: number | null = null;
  if (weightValid) {
    let total = 0;
    let hasScores = false;
    for (const act of activities) {
      const pct = getStudentScore(String(act.id), act.type);
      if (pct !== null) {
        total += (pct / 100) * act.weight;
        hasScores = true;
      }
    }
    finalScore = hasScores ? Math.round(total * 100) / 100 : null;
  }

  // Current module progress
  const currentModule =
    typeof offer.currentModule === "object" ? offer.currentModule : null;

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <nav className="mb-6">
        <Link
          href="/aluno"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Minhas Disciplinas
        </Link>
      </nav>

      <header className="mb-8">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          {courseCode} • {offer.period}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl mt-1">
          {courseTitle}
        </h1>
        {studentGroup && (
          <p className="text-sm text-muted-foreground mt-1">
            Grupo:{" "}
            <span className="font-medium text-foreground">
              {studentGroup.name}
            </span>
          </p>
        )}
      </header>

      <div className="space-y-10">
        {/* Progress */}
        {currentModule && (
          <section>
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Módulo Atual
            </h2>
            <Link
              href={
                courseSlug
                  ? `/disciplinas/${courseSlug}/${currentModule.slug}`
                  : "#"
              }
              className="block rounded-xl border p-4 hover:border-primary/30 transition-colors"
            >
              <p className="font-medium">{currentModule.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Clique para acessar o conteúdo
              </p>
            </Link>
          </section>
        )}

        {/* Grades */}
        <section>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Minhas Notas
          </h2>

          {activities.length > 0 ? (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-3 py-2 font-medium">
                      Atividade
                    </th>
                    <th className="text-center px-3 py-2 font-medium">Peso</th>
                    <th className="text-center px-3 py-2 font-medium">Tipo</th>
                    <th className="text-center px-3 py-2 font-medium">
                      Nota (%)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((act: any, idx: number) => {
                    const pct = getStudentScore(act.id, act.type);
                    return (
                      <tr
                        key={act.id}
                        className={`border-b last:border-b-0 ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                      >
                        <td className="px-3 py-2">
                          <span className="font-mono font-bold text-primary mr-2">
                            {act.acronym}
                          </span>
                          {act.description}
                        </td>
                        <td className="text-center px-3 py-2">
                          {act.weight.toFixed(1)}
                        </td>
                        <td className="text-center px-3 py-2 text-muted-foreground text-xs">
                          {act.type === "group" ? "Grupo" : "Individual"}
                        </td>
                        <td className="text-center px-3 py-2 font-medium">
                          {pct !== null ? (
                            `${pct}%`
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-primary/5 font-bold">
                    <td className="px-3 py-2" colSpan={3}>
                      Nota Final
                    </td>
                    <td className="text-center px-3 py-2">
                      {finalScore !== null ? (
                        <span
                          className={
                            finalScore >= 5
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }
                        >
                          {finalScore.toFixed(1)} / 10.0
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-xl">
              Nenhuma atividade cadastrada ainda.
            </p>
          )}
        </section>

        {/* Announcements */}
        <section>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Comunicados da Turma
          </h2>
          {posts.length > 0 ? (
            <div className="space-y-2">
              {posts.map((post: any) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between px-4 py-3 rounded-lg border text-sm"
                >
                  <span className="font-medium truncate">{post.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0 ml-3 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString("pt-BR")
                      : "—"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-xl">
              Nenhum comunicado publicado para esta turma.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
