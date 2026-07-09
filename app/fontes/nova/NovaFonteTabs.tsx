"use client";

import { useState } from "react";
import { createGoogleSheetsSource } from "../actions";
import { NovaFonteArquivoForm } from "./NovaFonteArquivoForm";

type Tab = "google_sheets" | "arquivo_upload";

export function NovaFonteTabs({
  eventos,
}: {
  eventos: { id: string; label: string }[];
}) {
  const [tab, setTab] = useState<Tab>("google_sheets");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
        <TabButton active={tab === "google_sheets"} onClick={() => setTab("google_sheets")}>
          Google Sheets
        </TabButton>
        <TabButton active={tab === "arquivo_upload"} onClick={() => setTab("arquivo_upload")}>
          Upload de arquivo
        </TabButton>
      </div>

      {tab === "google_sheets" ? (
        <form action={createGoogleSheetsSource} className="flex max-w-md flex-col gap-3">
          <select
            name="evento_id"
            required
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Selecione um evento</option>
            {eventos.map((evento) => (
              <option key={evento.id} value={evento.id}>
                {evento.label}
              </option>
            ))}
          </select>
          <input
            name="name"
            required
            placeholder="Nome da fonte (ex: Formulário Google Forms)"
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            name="sheet_url"
            required
            placeholder="Link da planilha (https://docs.google.com/spreadsheets/d/...)"
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            name="tab_name"
            placeholder="Nome da aba (opcional — padrão: primeira aba)"
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <p className="text-xs text-zinc-500">
            Lembre de compartilhar a planilha (somente leitura) com o e-mail
            da service account do Google — ver README.md.
          </p>
          <button
            type="submit"
            className="w-fit rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
          >
            Criar fonte
          </button>
        </form>
      ) : (
        <NovaFonteArquivoForm eventos={eventos} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium ${
        active
          ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50"
          : "text-zinc-500"
      }`}
    >
      {children}
    </button>
  );
}
