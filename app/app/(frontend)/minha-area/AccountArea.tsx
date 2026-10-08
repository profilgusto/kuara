"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { comBasePath } from "@/lib/base-path";
import { MAX_NAME_LENGTH } from "@/lib/account-request";
import {
  MIN_PASSWORD_LENGTH,
  validatePasswordChange,
  validateProfileName,
} from "@/lib/profile";
import { roleLabel } from "@/lib/user-menu";
import {
  useSession,
  type SessionUser,
} from "@/components/layout/SessionContext";

const FIELD_CLASS =
  "w-full rounded-md border border-border bg-input px-3 py-2 text-base sm:text-sm text-foreground transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const LABEL_CLASS =
  "mb-1 block font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground";

const BUTTON_CLASS =
  "inline-flex items-center justify-center rounded-md border border-primary bg-transparent px-4 py-1.5 text-sm font-medium text-primary transition-all hover:bg-primary hover:text-primary-foreground active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const SECTION_CLASS = "rounded-xl border border-border bg-card p-5 sm:p-6";

function sendJson(method: "POST" | "PATCH", path: string, body: unknown) {
  return fetch(comBasePath(path), {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
}

/**
 * /minha-area. Who is signed in comes from `SessionProvider`, like the rest
 * of the top bar, so the page itself stays static.
 */
export function AccountArea() {
  const { session, setSession } = useSession();
  return <AccountAreaContent session={session} onSessionChange={setSession} />;
}

/** The page body, without the session provider around it. */
export function AccountAreaContent({
  session,
  onSessionChange,
}: {
  session: SessionUser | null | undefined;
  onSessionChange: (session: SessionUser) => void;
}) {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Minha área
        </h1>
        <p className="mt-2 text-muted-foreground">
          Seus dados de cadastro no Kuara.
        </p>
      </header>

      {session === undefined ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : session === null ? (
        <p className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
          Você não está logado. Abra o menu do usuário, na barra superior, para
          entrar.
        </p>
      ) : (
        // Keyed by account: signing in as someone else must not keep what the
        // previous user typed.
        <div key={session.id} className="space-y-6">
          <ProfileSection user={session} />
          <NameSection user={session} onSaved={onSessionChange} />
          <PasswordSection />
        </div>
      )}
    </div>
  );
}

function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-md border-l-4 border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-900 dark:text-red-200"
    >
      {children}
    </p>
  );
}

function SuccessNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-md border-l-4 border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs leading-relaxed text-emerald-900 dark:text-emerald-200"
    >
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 text-lg font-semibold tracking-tight">{children}</h2>
  );
}

function ProfileSection({ user }: { user: SessionUser }) {
  return (
    <section className={SECTION_CLASS} aria-labelledby="perfil-titulo">
      <h2
        id="perfil-titulo"
        className="mb-4 text-lg font-semibold tracking-tight"
      >
        Perfil
      </h2>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className={LABEL_CLASS}>Nome</dt>
          <dd className="break-words text-sm text-foreground">{user.name}</dd>
        </div>
        <div className="min-w-0">
          <dt className={LABEL_CLASS}>E-mail</dt>
          <dd className="break-words text-sm text-foreground">{user.email}</dd>
        </div>
        <div>
          <dt className={LABEL_CLASS}>Perfil de acesso</dt>
          <dd>
            <span className="inline-block rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-widest text-primary">
              {roleLabel(user.role)}
            </span>
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        O e-mail e o perfil de acesso só podem ser alterados por um
        administrador.
      </p>
    </section>
  );
}

/**
 * Forms here use `noValidate`, as in the user menu: each one checks its
 * fields and reports in its own error box.
 */
function NameSection({
  user,
  onSaved,
}: {
  user: SessionUser;
  onSaved: (user: SessionUser) => void;
}) {
  const [name, setName] = useState(user.name);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const parsed = validateProfileName(name);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    setBusy(true);
    try {
      const res = await sendJson("PATCH", `/api/users/${user.id}`, {
        name: parsed.data,
      });
      if (!res.ok) {
        setError(
          res.status === 401 || res.status === 403
            ? "Sua sessão expirou. Entre novamente."
            : "Não foi possível salvar. Tente novamente.",
        );
        return;
      }
      setName(parsed.data);
      setSaved(true);
      // Updates the top-bar menu and the profile above without a reload.
      onSaved({ ...user, name: parsed.data });
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={SECTION_CLASS}>
      <SectionTitle>Alterar nome</SectionTitle>
      <form onSubmit={submit} noValidate className="space-y-3">
        <div>
          <label htmlFor="account-name" className={LABEL_CLASS}>
            Nome
          </label>
          <input
            id="account-name"
            name="name"
            type="text"
            autoComplete="name"
            maxLength={MAX_NAME_LENGTH}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            className={FIELD_CLASS}
          />
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}
        {saved && <SuccessNote>Nome atualizado.</SuccessNote>}

        <button
          type="submit"
          disabled={busy || name.trim() === user.name}
          className={BUTTON_CLASS}
        >
          {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Salvar nome
        </button>
      </form>
    </section>
  );
}

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const parsed = validatePasswordChange({ currentPassword, newPassword });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (newPassword !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }

    setBusy(true);
    try {
      const res = await sendJson(
        "POST",
        "/api/users/change-password",
        parsed.data,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          data?.error || "Não foi possível alterar a senha. Tente novamente.",
        );
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setSaved(true);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={SECTION_CLASS}>
      <SectionTitle>Alterar senha</SectionTitle>
      <form onSubmit={submit} noValidate className="space-y-3">
        <div>
          <label htmlFor="account-current-password" className={LABEL_CLASS}>
            Senha atual
          </label>
          <input
            id="account-current-password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={FIELD_CLASS}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="account-new-password" className={LABEL_CLASS}>
              Nova senha
            </label>
            <input
              id="account-new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label htmlFor="account-confirm-password" className={LABEL_CLASS}>
              Confirme a nova senha
            </label>
            <input
              id="account-confirm-password"
              name="confirmation"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className={FIELD_CLASS}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Mínimo de {MIN_PASSWORD_LENGTH} caracteres.
        </p>

        {error && <ErrorNote>{error}</ErrorNote>}
        {saved && <SuccessNote>Senha alterada.</SuccessNote>}

        <button type="submit" disabled={busy} className={BUTTON_CLASS}>
          {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Alterar senha
        </button>
      </form>
    </section>
  );
}
