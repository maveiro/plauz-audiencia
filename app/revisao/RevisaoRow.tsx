"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/app/_components/ToastProvider";
import { resolveRevisao } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RevisaoRow({
  interessadoId,
  nomeCompleto,
  cidadeInformada,
  estadoInformada,
  sugestaoIA,
}: {
  interessadoId: string;
  nomeCompleto: string | null;
  cidadeInformada: string | null;
  estadoInformada: string | null;
  sugestaoIA?: { cidade: string | null; estado: string | null; motivo: string | null } | null;
}) {
  const [cidade, setCidade] = useState(sugestaoIA?.cidade ?? cidadeInformada ?? "");
  const [estado, setEstado] = useState(sugestaoIA?.estado ?? estadoInformada ?? "");
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const showToast = useToast();

  function handleConfirm() {
    startTransition(async () => {
      try {
        await resolveRevisao(interessadoId, cidade, estado);
        setDone(true);
      } catch (err) {
        showToast(`Erro ao salvar revisão: ${(err as Error).message}`, "error");
      }
    });
  }

  if (done) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="min-w-[10rem]">
        <p className="text-sm font-medium">{nomeCompleto || "(sem nome)"}</p>
        <p className="text-xs text-zinc-500">
          informado: {cidadeInformada || "—"} / {estadoInformada || "—"}
        </p>
        {sugestaoIA?.cidade && (
          <p className="text-xs text-indigo-600 dark:text-indigo-400">
            IA sugere: {sugestaoIA.cidade} / {sugestaoIA.estado || "—"}
            {sugestaoIA.motivo ? ` — ${sugestaoIA.motivo}` : ""}
          </p>
        )}
      </div>
      <Label htmlFor={`cidade-${interessadoId}`} className="sr-only">
        Cidade normalizada
      </Label>
      <Input
        id={`cidade-${interessadoId}`}
        value={cidade}
        onChange={(e) => setCidade(e.target.value)}
        placeholder="cidade normalizada"
        className="h-8 w-auto"
      />
      <Label htmlFor={`estado-${interessadoId}`} className="sr-only">
        UF
      </Label>
      <Input
        id={`estado-${interessadoId}`}
        value={estado}
        onChange={(e) => setEstado(e.target.value)}
        placeholder="UF"
        maxLength={2}
        className="h-8 w-16 uppercase"
      />
      <Button type="button" size="sm" onClick={handleConfirm} disabled={isPending}>
        {isPending ? "Salvando..." : "Confirmar"}
      </Button>
    </div>
  );
}
