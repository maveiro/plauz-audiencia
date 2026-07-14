"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/_components/ToastProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ReenviarArquivoForm({ sourceId }: { sourceId: string }) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const showToast = useToast();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await fetch(`/api/sources/${sourceId}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        showToast(
          `Arquivo reenviado. ${data.sync?.rowsInserted ?? 0} novo(s) de ${data.sync?.rowsFound ?? 0} encontrado(s).`,
          "success",
        );
        formRef.current?.reset();
      } else {
        showToast(`Erro ao reenviar arquivo: ${data.error ?? "falha desconhecida"}`, "error");
      }
      router.refresh();
    });
  }

  const inputId = `reenviar-arquivo-${sourceId}`;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex items-center gap-2">
      <Label htmlFor={inputId} className="sr-only">
        Arquivo
      </Label>
      <Input
        id={inputId}
        type="file"
        name="file"
        accept=".csv,.xls,.xlsx"
        required
        className="h-auto text-xs file:text-xs"
      />
      <Button type="submit" variant="outline" size="sm" disabled={isPending}>
        {isPending ? "Enviando..." : "Reenviar arquivo"}
      </Button>
    </form>
  );
}
