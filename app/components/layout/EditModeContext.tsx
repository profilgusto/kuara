"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "./SessionContext";

interface EditModeContextValue {
  /** The page on screen has editable parts and an admin is signed in. */
  canEdit: boolean;
  /** Edit mode is on. Never true without `canEdit`. */
  editing: boolean;
  setEditing: (editing: boolean) => void;
  /** Called by a page with editable parts; returns its unregister function. */
  registerEditable: () => () => void;
}

const EditModeContext = createContext<EditModeContextValue | null>(null);

/**
 * In-page edit mode, switched on from the pencil in the top bar.
 *
 * A page opts in with `useEditablePage()`; the pencil only shows on those
 * pages, and only to an admin. The mode belongs to the page it was turned on
 * for: leaving the page or signing out switches it off.
 */
export function EditModeProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [editablePages, setEditablePages] = useState(0);
  const [active, setActive] = useState(false);

  const canEdit = editablePages > 0 && session?.role === "admin";
  const editing = active && canEdit;

  // Without this, the mode would silently come back on the next editable
  // page, or after signing in again.
  useEffect(() => {
    if (!canEdit) setActive(false);
  }, [canEdit]);

  const registerEditable = useCallback(() => {
    setEditablePages((n) => n + 1);
    return () => setEditablePages((n) => n - 1);
  }, []);

  const value = useMemo(
    () => ({ canEdit, editing, setEditing: setActive, registerEditable }),
    [canEdit, editing, registerEditable],
  );

  return (
    <EditModeContext.Provider value={value}>
      {children}
    </EditModeContext.Provider>
  );
}

export function useEditMode() {
  const ctx = useContext(EditModeContext);
  if (!ctx) throw new Error("useEditMode must be used within EditModeProvider");
  return ctx;
}

/**
 * Marks the page rendering this component as editable, which makes the pencil
 * appear in the top bar. Returns whether edit mode is on.
 *
 * `enabled: false` is for a component shared with a page that does not offer
 * the tool: it registers nothing, so no pencil shows, and always gets false.
 */
export function useEditablePage(enabled: boolean = true): boolean {
  const { editing, registerEditable } = useEditMode();
  useEffect(() => {
    if (enabled) return registerEditable();
  }, [enabled, registerEditable]);
  return enabled && editing;
}
