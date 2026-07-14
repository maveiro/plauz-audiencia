"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TRANSFORM_NAMES } from "@/lib/transforms";
import { useToast } from "@/app/_components/ToastProvider";
import { saveFieldMappings, type FieldMappingInput } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Radix Select não aceita SelectItem com value="" — sentinela traduzido
// pra `null` (transform ausente) na borda do estado.
const SEM_TRANSFORM = "__sem_transform__";

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
            <Select
              value={row.source_field}
              onValueChange={(value) => updateRow(index, { source_field: value })}
            >
              <SelectTrigger aria-label="Coluna de origem">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {detectedColumns.map((col) => (
                  <SelectItem key={col} value={col}>
                    {col}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">→</span>
            <Select
              value={row.canonical_field}
              onValueChange={(value) =>
                updateRow(index, {
                  canonical_field: value as FieldMappingInput["canonical_field"],
                })
              }
            >
              <SelectTrigger aria-label="Campo canônico">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CANONICAL_FIELDS.map((field) => (
                  <SelectItem key={field} value={field}>
                    {CANONICAL_FIELD_LABELS[field]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={row.transform ?? SEM_TRANSFORM}
              onValueChange={(value) =>
                updateRow(index, { transform: value === SEM_TRANSFORM ? null : value })
              }
            >
              <SelectTrigger aria-label="Transform">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_TRANSFORM}>sem transform</SelectItem>
                {TRANSFORM_NAMES.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => removeRow(index)}
              className="text-destructive"
            >
              remover
            </Button>
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
        <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={detectedColumns.length === 0}>
          + Adicionar mapeamento
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar mapeamento"}
        </Button>
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
