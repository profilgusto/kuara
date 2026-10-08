"use client";

import {
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, User } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { comBasePath } from "@/lib/base-path";
import { useSession, type SessionUser } from "./SessionContext";
import { menuLinksForRole, roleLabel } from "@/lib/user-menu";
import {
  MAX_MESSAGE_LENGTH,
  type RequestableRole,
} from "@/lib/account-request";

export type { SessionUser };

/** Which form the signed-out menu is showing. */
export type AnonymousView = "login" | "recover" | "request";

const FIELD_CLASS =
  "w-full rounded-md border border-border bg-input px-3 py-1.5 text-base sm:text-sm text-foreground transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const LABEL_CLASS =
  "mb-1 block font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground";

const PRIMARY_BUTTON_CLASS =
  "inline-flex w-full items-center justify-center rounded-md border border-primary bg-transparent px-4 py-1.5 text-sm font-medium text-primary transition-all hover:bg-primary hover:text-primary-foreground active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const TEXT_BUTTON_CLASS =
  "text-primary underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-50";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MOBILE_QUERY = "(max-width: 639px)";

/**
 * `true` below the `sm` breakpoint. On the server and during hydration it is
 * `false`, and the menu starts closed, so the switch causes no visible
 * mismatch.
 */
function useIsMobile() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(MOBILE_QUERY);
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

function postJson(path: string, body?: unknown) {
  return fetch(comBasePath(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/**
 * User icon button in the top bar, with its dropdown.
 *
 * Who is signed in comes from `SessionProvider`, shared with the rest of the
 * top bar.
 *
 * On desktop the menu is a popover anchored to the button; on a phone, a
 * sheet sliding in from the right.
 */
export function UserMenu() {
  const [open, setOpen] = useState(false);
  const mobile = useIsMobile();
  const { session, setSession } = useSession();
  // Popover content unmounts on close. Kept up here, the form the visitor was
  // on and the e-mail they typed survive a click outside the menu.
  const [view, setView] = useState<AnonymousView>("login");
  const [email, setEmail] = useState("");

  const label = session ? `Conta de ${session.name}` : "Entrar";
  const triggerClass = `flex items-center justify-center h-6 w-6 rounded transition-colors ${
    session
      ? "bg-primary/15 text-primary hover:bg-primary/25"
      : "text-muted-foreground hover:bg-muted hover:text-foreground"
  }`;
  const icon = <User className="h-3.5 w-3.5" />;

  const content = (
    <UserMenuContent
      session={session}
      view={view}
      setView={setView}
      email={email}
      setEmail={setEmail}
      onSessionChange={setSession}
      close={() => setOpen(false)}
    />
  );

  if (mobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger aria-label={label} className={triggerClass}>
          {icon}
        </SheetTrigger>
        <SheetContent
          side="right"
          aria-describedby={undefined}
          className="w-[85vw] max-w-sm overflow-y-auto pt-12"
        >
          <SheetTitle className="sr-only">{label}</SheetTitle>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label={label} className={triggerClass}>
        {icon}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="w-72">
        {content}
      </PopoverContent>
    </Popover>
  );
}

/** The menu body, without the popover/sheet shell around it. */
export function UserMenuContent({
  session,
  view,
  setView,
  email,
  setEmail,
  onSessionChange,
  close,
}: {
  session: SessionUser | null | undefined;
  view: AnonymousView;
  setView: (view: AnonymousView) => void;
  email: string;
  setEmail: (email: string) => void;
  onSessionChange: (session: SessionUser | null) => void;
  close: () => void;
}) {
  if (session === undefined) {
    return (
      <div className="flex justify-center py-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (session) {
    return (
      <SignedInPanel
        user={session}
        onSignedOut={() => onSessionChange(null)}
        close={close}
      />
    );
  }

  if (view === "recover") {
    return (
      <RecoverPanel
        email={email}
        setEmail={setEmail}
        back={() => setView("login")}
      />
    );
  }

  if (view === "request") {
    return (
      <RequestPanel
        email={email}
        setEmail={setEmail}
        back={() => setView("login")}
      />
    );
  }

  return (
    <LoginPanel
      email={email}
      setEmail={setEmail}
      setView={setView}
      onSignedIn={(user) => {
        onSessionChange(user);
        close();
      }}
    />
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

function EmailField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        E-mail
      </label>
      <input
        id={id}
        name="email"
        type="email"
        autoComplete="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD_CLASS}
      />
    </div>
  );
}

/**
 * Forms here use `noValidate`: the browser's own validation bubble comes out
 * in the browser's language and outside the site's look, so each panel checks
 * its fields and reports in its own error box.
 */
function LoginPanel({
  email,
  setEmail,
  setView,
  onSignedIn,
}: {
  email: string;
  setEmail: (email: string) => void;
  setView: (view: AnonymousView) => void;
  onSignedIn: (user: SessionUser) => void;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!EMAIL_PATTERN.test(email.trim()) || !password) {
      setError("Informe seu e-mail e sua senha.");
      return;
    }

    setBusy(true);
    try {
      const res = await postJson("/api/users/login", {
        email: email.trim(),
        password,
      });
      if (!res.ok) {
        setError(
          res.status === 401
            ? "E-mail ou senha inválidos."
            : "Não foi possível entrar. Tente novamente em instantes.",
        );
        return;
      }
      const data = await res.json();
      onSignedIn(data.user);
      // Pages that read the session on the server need to render again.
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <p className="text-sm font-medium text-foreground">
        Você não está logado
      </p>

      <EmailField id="menu-email" value={email} onChange={setEmail} />

      <div>
        <label htmlFor="menu-password" className={LABEL_CLASS}>
          Senha
        </label>
        <input
          id="menu-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={FIELD_CLASS}
        />
        <div className="mt-1 text-right">
          <button
            type="button"
            onClick={() => setView("recover")}
            className="text-[11px] text-muted-foreground/70 underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Esqueceu a senha?
          </button>
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <button type="submit" disabled={busy} className={PRIMARY_BUTTON_CLASS}>
        {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
        Entrar
      </button>
    </form>
  );
}

function RecoverPanel({
  email,
  setEmail,
  back,
}: {
  email: string;
  setEmail: (email: string) => void;
  back: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError("Informe um e-mail válido.");
      return;
    }

    setBusy(true);
    try {
      const res = await postJson("/api/users/forgot-password", {
        email: email.trim(),
      });
      if (!res.ok) {
        setError("Não foi possível enviar o link. Tente novamente.");
        return;
      }
      setSent(true);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Recuperar senha</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Enviaremos para o seu e-mail um link para escolher uma nova senha.
        </p>
      </div>

      {sent ? (
        // Same message whether or not the address has an account, so the
        // form cannot be used to find out who is registered.
        <SuccessNote>
          Se houver uma conta com <strong>{email.trim()}</strong>, o link foi
          enviado. Olhe sua caixa de entrada (e o spam). Ele vale por 1 hora.
        </SuccessNote>
      ) : (
        <>
          <EmailField
            id="menu-recover-email"
            value={email}
            onChange={setEmail}
          />
          {error && <ErrorNote>{error}</ErrorNote>}
          <button
            type="submit"
            disabled={busy}
            className={PRIMARY_BUTTON_CLASS}
          >
            {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Enviar link
          </button>
        </>
      )}

      <p className="pt-1 text-center text-xs">
        <button type="button" onClick={back} className={TEXT_BUTTON_CLASS}>
          Voltar para o login
        </button>
      </p>
    </form>
  );
}

function RequestPanel({
  email,
  setEmail,
  back,
}: {
  email: string;
  setEmail: (email: string) => void;
  back: () => void;
}) {
  const [name, setName] = useState("");
  const [requestedRole, setRequestedRole] =
    useState<RequestableRole>("student");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Informe seu nome.");
      return;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError("Informe um e-mail válido.");
      return;
    }

    setBusy(true);
    try {
      const res = await postJson("/api/account-requests/request", {
        name,
        email,
        requestedRole,
        message,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          data?.error ||
            "Não foi possível enviar a solicitação. Tente novamente.",
        );
        return;
      }
      setSent(true);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Solicitar conta</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          O conteúdo do Kuara é público. A conta dá acesso às áreas de aluno e
          de professor, e passa por aprovação.
        </p>
      </div>

      {sent ? (
        <SuccessNote>
          Solicitação enviada. Quando ela for aprovada, você receberá em{" "}
          <strong>{email.trim()}</strong> um link para definir sua senha.
        </SuccessNote>
      ) : (
        <>
          <div>
            <label htmlFor="menu-request-name" className={LABEL_CLASS}>
              Nome
            </label>
            <input
              id="menu-request-name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={FIELD_CLASS}
            />
          </div>

          <EmailField
            id="menu-request-email"
            value={email}
            onChange={setEmail}
          />

          <div>
            <label htmlFor="menu-request-role" className={LABEL_CLASS}>
              Perfil
            </label>
            <select
              id="menu-request-role"
              name="requestedRole"
              value={requestedRole}
              onChange={(e) =>
                setRequestedRole(e.target.value as RequestableRole)
              }
              className={FIELD_CLASS}
            >
              <option value="student">Aluno</option>
              <option value="professor">Professor</option>
            </select>
          </div>

          <div>
            <label htmlFor="menu-request-message" className={LABEL_CLASS}>
              Mensagem (opcional)
            </label>
            <textarea
              id="menu-request-message"
              name="message"
              rows={3}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder="Disciplina, turma ou motivo do pedido"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className={`${FIELD_CLASS} resize-none`}
            />
          </div>

          {error && <ErrorNote>{error}</ErrorNote>}

          <button
            type="submit"
            disabled={busy}
            className={PRIMARY_BUTTON_CLASS}
          >
            {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Enviar solicitação
          </button>
        </>
      )}

      <p className="pt-1 text-center text-xs text-muted-foreground">
        {!sent && "Já tem conta? "}
        <button type="button" onClick={back} className={TEXT_BUTTON_CLASS}>
          {sent ? "Voltar para o login" : "Entrar"}
        </button>
      </p>
    </form>
  );
}

const ITEM_CLASS =
  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted";

function SignedInPanel({
  user,
  onSignedOut,
  close,
}: {
  user: SessionUser;
  onSignedOut: () => void;
  close: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const links = menuLinksForRole(user.role);

  async function signOut() {
    setBusy(true);
    setError(null);
    try {
      const res = await postJson("/api/users/logout");
      if (!res.ok) {
        setError("Não foi possível sair. Tente novamente.");
        return;
      }
      onSignedOut();
      close();
      router.push("/");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {user.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        <p className="mt-1.5 inline-block rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-widest text-primary">
          {roleLabel(user.role)}
        </p>
      </div>

      {links.length > 0 && (
        <nav className="border-t border-border pt-2" aria-label="Sua conta">
          {links.map((link) =>
            link.external ? (
              <a
                key={link.href}
                href={comBasePath(link.href)}
                className={ITEM_CLASS}
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                className={ITEM_CLASS}
              >
                {link.label}
              </Link>
            ),
          )}
        </nav>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="border-t border-border pt-2">
        <button
          type="button"
          onClick={signOut}
          disabled={busy}
          className={`${ITEM_CLASS} text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50`}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LogOut className="h-3.5 w-3.5" />
          )}
          Sair
        </button>
      </div>
    </div>
  );
}
