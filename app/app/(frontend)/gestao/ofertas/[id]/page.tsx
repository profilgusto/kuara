import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  getCurrentUser,
  getOffer,
  getOfferActivities,
  getOfferPosts,
  getCourseModules,
} from "@/lib/payload-professor";
import {
  ArrowLeft,
  BookOpen,
  Users,
  ClipboardList,
  Megaphone,
  Settings,
  Calendar,
} from "lucide-react";
import { OfferDashboardClient } from "./OfferDashboardClient";

export const dynamic = "force-dynamic";

export default async function OfferDashboardPage({
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

  const courseObj = typeof offer.course === "object" ? offer.course : null;
  const courseId = String(
    courseObj?.id ?? (typeof offer.course === "string" ? offer.course : ""),
  );
  const courseTitle = courseObj?.title || "Disciplina";
  const courseCode = courseObj?.code || "";

  const [activities, posts, modules] = await Promise.all([
    getOfferActivities(id),
    getOfferPosts(id),
    getCourseModules(courseId),
  ]);

  const students = Array.isArray(offer.students)
    ? offer.students.map((s: any) => (typeof s === "object" ? s : { id: s }))
    : [];

  const rawCurrentModule =
    typeof offer.currentModule === "object"
      ? offer.currentModule?.id
      : offer.currentModule ?? null;
  const currentModuleId: string | null =
    rawCurrentModule != null ? String(rawCurrentModule) : null;

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Back navigation */}
      <nav className="mb-6">
        <Link
          href="/gestao"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Gestão
        </Link>
      </nav>

      {/* Header */}
      <header className="mb-8">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          {courseCode} • {offer.period}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl mt-1">
          {courseTitle}
        </h1>
        <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {students.length} aluno{students.length !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4" />
            {activities.length} atividade{activities.length !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {offer.status === "active" ? "Ativa" : "Arquivada"}
          </span>
        </div>
      </header>

      {/* Quick action cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-10">
        <QuickLink
          href={`/gestao/ofertas/${id}/notas`}
          icon={<ClipboardList className="h-5 w-5" />}
          label="Notas"
          desc="Gerenciar atividades e notas"
        />
        <QuickLink
          href={`/gestao/ofertas/${id}/grupos`}
          icon={<Users className="h-5 w-5" />}
          label="Grupos"
          desc="Organizar grupos de alunos"
        />
        <QuickLink
          href={`/admin/collections/posts/create?offer=${id}`}
          icon={<Megaphone className="h-5 w-5" />}
          label="Novo Comunicado"
          desc="Enviar notícia para a turma"
        />
        <QuickLink
          href={`/admin/collections/offers/${id}`}
          icon={<Settings className="h-5 w-5" />}
          label="Config"
          desc="Editar no painel admin"
        />
      </div>

      {/* Client-side interactive sections */}
      <OfferDashboardClient
        offerId={id}
        modules={modules.map((m: any) => ({
          id: m.id,
          title: m.title,
          slug: m.slug,
          type: m.type,
          order: m.order,
        }))}
        currentModuleId={currentModuleId}
        posts={posts.map((p: any) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          publishedAt: p.publishedAt,
        }))}
        students={students.map((s: any) => ({
          id: s.id,
          name: s.name || s.email || "Aluno",
        }))}
      />
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
  desc,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-xl border p-4 transition-all hover:shadow-sm hover:border-primary/30"
    >
      <div className="bg-primary/10 p-2 rounded-lg text-primary shrink-0 group-hover:bg-primary/20 transition-colors">
        {icon}
      </div>
      <div>
        <p className="font-medium text-sm group-hover:text-primary transition-colors">
          {label}
        </p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </Link>
  );
}
