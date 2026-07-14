"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/_components/ToastProvider";
import { updateSourceMeta } from "../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EditSourceForm({
  sourceId,
  tipo,
  name,
  sheetUrl,
  tabName,
}: {
  sourceId: string;
  tipo: "google_sheets" | "arquivo_upload" | "formulario_nativo";
  name: string;
  sheetUrl: string | null;
  tabName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const showToast = useToast();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateSourceMeta(sourceId, formData);
        showToast("Fonte atualizada.", "success");
        setOpen(false);
        router.refresh();
      } catch (err) {
        showToast(`Erro ao atualizar fonte: ${(err as Error).message}`, "error");
      }
    });
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className="w-fit">
        Editar dados da fonte
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-w-md flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit_name">Nome da fonte</Label>
        <Input id="edit_name" name="name" defaultValue={name} required placeholder="Nome da fonte" />
      </div>
      {tipo === "google_sheets" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit_sheet_url">Link da planilha</Label>
            <Input
              id="edit_sheet_url"
              name="sheet_url"
              defaultValue={sheetUrl ?? ""}
              required
              placeholder="https://docs.google.com/spreadsheets/d/..."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit_tab_name">Nome da aba (opcional)</Label>
            <Input
              id="edit_tab_name"
              name="tab_name"
              defaultValue={tabName ?? ""}
              placeholder="Padrão: primeira aba"
            />
          </div>
        </>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending} className="w-fit">
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(false)}
          disabled={isPending}
          className="w-fit"
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
