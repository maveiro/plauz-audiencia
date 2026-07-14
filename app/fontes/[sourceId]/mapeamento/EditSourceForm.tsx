"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/_components/ToastProvider";
import { updateSourceMeta } from "../../actions";

export function EditSourceForm({
  sourceId,
  tipo,
  name,
  sheetUrl,
  tabName,
}: {
  sourceId: string;
  tipo: "google_sheets" | "arquivo_upload";
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-fit rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Editar dados da fonte
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-w-md flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <input
        name="name"
        defaultValue={name}
        required
        placeholder="Nome da fonte"
        className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      {tipo === "google_sheets" && (
        <>
          <input
            name="sheet_url"
            defaultValue={sheetUrl ?? ""}
            required
            placeholder="Link da planilha (https://docs.google.com/spreadsheets/d/...)"
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            name="tab_name"
            defaultValue={tabName ?? ""}
            placeholder="Nome da aba (opcional — padrão: primeira aba)"
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </>
      )}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="w-fit rounded bg-zinc-900 px-4 py-1.5 text-sm font-medium text-zinc-50 hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {isPending ? "Salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={isPending}
          className="w-fit rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
