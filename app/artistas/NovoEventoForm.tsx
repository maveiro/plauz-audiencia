"use client";

import { createEvento } from "./actions";
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

export function NovoEventoForm({
  artistas,
}: {
  artistas: { id: string; nome: string }[];
}) {
  return (
    <form action={createEvento} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="artista_id">Artista</Label>
        <Select name="artista_id" required>
          <SelectTrigger id="artista_id">
            <SelectValue placeholder="Selecione um artista" />
          </SelectTrigger>
          <SelectContent>
            {artistas.map((artista) => (
              <SelectItem key={artista.id} value={artista.id}>
                {artista.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="evento_nome">Nome do evento</Label>
        <Input id="evento_nome" name="nome" required placeholder="Nome do evento" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="data_evento">Data</Label>
        <Input id="data_evento" type="date" name="data_evento" />
      </div>
      <Button type="submit">Criar</Button>
    </form>
  );
}
