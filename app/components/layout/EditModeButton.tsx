"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEditMode } from "./EditModeContext";

/**
 * Pencil in the top bar. Renders nothing unless the page on screen is
 * editable and an admin is signed in.
 *
 * Turning the mode on asks first; turning it off does not.
 */
export function EditModeButton() {
  const { canEdit, editing, setEditing } = useEditMode();
  const [confirming, setConfirming] = useState(false);

  if (!canEdit) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => (editing ? setEditing(false) : setConfirming(true))}
        aria-pressed={editing}
        aria-label={
          editing ? "Sair do modo de edição" : "Ativar modo de edição"
        }
        title={editing ? "Sair do modo de edição" : "Ativar modo de edição"}
        className={`flex items-center justify-center h-6 w-6 rounded transition-colors ${
          editing
            ? "bg-primary text-primary-foreground hover:bg-primary/85"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogTitle>Deseja mesmo ativar o modo de edição?</DialogTitle>
          <DialogDescription>
            Os campos editáveis desta página passam a mostrar um lápis. O que
            você salvar fica visível para todos imediatamente.
          </DialogDescription>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" size="sm">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              size="sm"
              onClick={() => {
                setEditing(true);
                setConfirming(false);
              }}
            >
              Ativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
