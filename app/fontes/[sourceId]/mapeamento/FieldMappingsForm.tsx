"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TRANSFORM_NAMES } from "@/lib/transforms";
import { useToast } from "@/app/_components/ToastProvider";
import { saveFieldMappings, type FieldMappingInput } from "./actions";

const CANONICAL_FIELD_LABELS: Record<FieldMappingInput["canonical_field"], string> = {
  nome_completo: "Nome completo",
  telefone: "Telefone",
  email: "E-mail",
  cidade: "Cidade",
  estado: "Estado",
  submitted_at: "Data de envio",
};

const CANONICAL_FIELDS = Object.keys(
  CANONICAL_FIELD_LABELS,
) as FieldMappingInput["canonical_field"][];

const DATE_TRANSFORMS = ["parse_date_dmy", "parse_date_mdy"];

export function FieldMappingsForm({
  sourceId,
  detectedColumns,
  initialMappings,
}: {
  sourceId: string;
  detectedColumns: string[];
  initialMappings: FieldMappingInput[];
}) {
  const [rows, setRows] = useState<FieldMappingInput[]>(initialMappings);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const showToast = useToast();

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        source_field: detectedColumns[0] ?? "",
        canonical_field: "nome_completo",
        transform: null,
      },
    ]);
  }

  function updateRow(index: number, patch: Partial<FieldMappingInput>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await saveFieldMappings(sourceId, rows);
        showToast("Mapeamento salvo.", "success");
        router.refresh();
      } catch (err) {
        showToast(`Erro ao salvar mapeamento: ${(err as Error).message}`, "error");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <select
              value={row.source_field}
              onChange={(e) => updateRow(index, { source_field: e.target.value })}
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {detectedColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
            <span className="text-zinc-400">→</span>
            <select
              value={row.canonical_field}
              onChange={(e) =>
                updateRow(index, {
                  canonical_field: e.target.value as FieldMappingInput["canonical_field"],
                })
              }
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {CANONICAL_FIELDS.map((field) => (
                <option key={field} value={field}>
                  {CANONICAL_FIELD_LABELS[field]}
                </option>
              ))}
            </select>
            <select
              value={row.transform ?? ""}
              onChange={(e) => updateRow(index, { transform: e.target.value || null })}
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">sem transform</option>
              {TRANSFORM_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeRow(index)}
              className="text-xs text-red-600 hover:underline dark:text-red-400"
            >
              remover
            </button>
            {row.canonical_field === "submitted_at" &&
              !DATE_TRANSFORMS.includes(row.transform ?? "") && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠ escolha <code>parse_date_dmy</code> (planilha em pt-BR) ou{" "}
                  <code>parse_date_mdy</code> (planilha em en-US) — sem isso a
                  data de envio fica em branco.
                </span>
              )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          disabled={detectedColumns.length === 0}
          className="w-fit rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          + Adicionar mapeamento
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="w-fit rounded bg-zinc-900 px-4 py-1.5 text-sm font-medium text-zinc-50 hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {isPending ? "Salvando..." : "Salvar mapeamento"}
        </button>
      </div>

      <p className="text-xs text-zinc-500">
        Uma mesma coluna de origem pode alimentar mais de um campo canônico —
        útil para transforms como <code>split_cidade_estado_cidade</code> /{" "}
        <code>split_cidade_estado_uf</code>, que extraem cidade e estado da
        mesma coluna de texto livre.
      </p>
    </div>
  );
}
