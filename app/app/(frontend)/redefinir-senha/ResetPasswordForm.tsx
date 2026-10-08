"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { comBasePath } from "@/lib/base-path";
import { MIN_PASSWORD_LENGTH } from "@/lib/profile";

const FIELD_CLASS =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 transition-shadow";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(
        `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      );
      return;
    }
    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(comBasePath("/api/users/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        setError(
          "Este link é inválido ou expirou. Peça um novo em “Esqueceu a senha?”, no menu do usuário.",
        );
        return;
      }
      // Payload signs the user in as part of the reset (it sets the session
      // cookie on this response), so there is no separate login step.
      router.push("/");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-primary/10 p-3 rounded-full mb-4">
            <KeyRound className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Definir senha</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Escolha a senha da sua conta no Kuara
          </p>
        </div>

        {!token ? (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive"
          >
            Este endereço precisa do link enviado por e-mail. Abra o menu do
            usuário, na barra superior, e use “Esqueceu a senha?” para receber
            um novo.
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="new-password"
                className="block text-sm font-medium mb-1.5"
              >
                Nova senha
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={FIELD_CLASS}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Mínimo de {MIN_PASSWORD_LENGTH} caracteres.
              </p>
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="block text-sm font-medium mb-1.5"
              >
                Confirme a senha
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar senha
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
