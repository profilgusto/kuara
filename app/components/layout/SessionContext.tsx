"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { comBasePath } from "@/lib/base-path";

export interface SessionUser {
  id: string | number;
  name: string;
  email: string;
  role: string;
}

interface SessionContextValue {
  /** undefined = not checked yet; null = signed out. */
  session: SessionUser | null | undefined;
  setSession: (session: SessionUser | null) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Who is signed in, for the top bar and anything else that changes with it.
 *
 * Client-side on purpose: reading the session in the root layout would make
 * every page dynamic. Here the layout stays static and only this piece asks
 * Payload who is signed in (/api/users/me), after hydration.
 *
 * It only decides what to show. Whatever a signed-in user can actually do is
 * enforced by Payload's access control on each request.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<SessionUser | null | undefined>(
    undefined,
  );

  // Re-checked on navigation: the session can change outside the menu
  // (the /login and /redefinir-senha pages, an expired cookie).
  useEffect(() => {
    let cancelled = false;
    fetch(comBasePath("/api/users/me"), { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setSession(data?.user ?? null);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <SessionContext.Provider value={{ session, setSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
