"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function NovaFonteArquivoForm({
  eventos,
}: {
  eventos: { id: string; label: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setErrorMessage(null);

    startTransition(async () => {
      const res = await fetch("/api/sources/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error ?? "Falha ao enviar arquivo.");
        return;
      }
      router.push(`/fontes/${data.source.id}/mapeamento`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="evento_id_upload">Evento</Label>
        <Select name="evento_id" required>
          <SelectTrigger id="evento_id_upload" className="w-full">
            <SelectValue placeholder="Selecione um evento" />
          </SelectTrigger>
          <SelectContent>
            {eventos.map((evento) => (
              <SelectItem key={evento.id} value={evento.id}>
                {evento.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name_upload">Nome da fonte</Label>
        <Input id="name_upload" name="name" required placeholder="Ex: Formulário site oficial" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="file">Arquivo (CSV, XLS ou XLSX)</Label>
        <Input id="file" type="file" name="file" accept=".csv,.xls,.xlsx" required />
      </div>
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Enviando..." : "Criar fonte"}
      </Button>
    </form>
  );
}
