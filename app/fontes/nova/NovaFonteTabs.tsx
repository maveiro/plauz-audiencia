"use client";

import { useState } from "react";
import { createGoogleSheetsSource } from "../actions";
import { NovaFonteArquivoForm } from "./NovaFonteArquivoForm";
import { NovaFonteFormularioForm } from "./NovaFonteFormularioForm";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Tab = "google_sheets" | "arquivo_upload" | "formulario_nativo";

export function NovaFonteTabs({
  eventos,
}: {
  eventos: { id: string; label: string }[];
}) {
  const [tab, setTab] = useState<Tab>("google_sheets");

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="flex flex-col gap-6">
      <TabsList variant="line">
        <TabsTrigger value="google_sheets">Google Sheets</TabsTrigger>
        <TabsTrigger value="arquivo_upload">Upload de arquivo</TabsTrigger>
        <TabsTrigger value="formulario_nativo">Formulário nativo</TabsTrigger>
      </TabsList>

      <TabsContent value="google_sheets">
        <form action={createGoogleSheetsSource} className="flex max-w-md flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="evento_id">Evento</Label>
            <Select name="evento_id" required>
              <SelectTrigger id="evento_id" className="w-full">
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
            <Label htmlFor="name">Nome da fonte</Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="Ex: Formulário Google Forms"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sheet_url">Link da planilha</Label>
            <Input
              id="sheet_url"
              name="sheet_url"
              required
              placeholder="https://docs.google.com/spreadsheets/d/..."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tab_name">Nome da aba (opcional)</Label>
            <Input id="tab_name" name="tab_name" placeholder="Padrão: primeira aba" />
          </div>
          <p className="text-xs text-muted-foreground">
            Lembre de compartilhar a planilha (somente leitura) com o e-mail
            da service account do Google — ver README.md.
          </p>
          <Button type="submit" className="w-fit">
            Criar fonte
          </Button>
        </form>
      </TabsContent>

      <TabsContent value="arquivo_upload">
        <NovaFonteArquivoForm eventos={eventos} />
      </TabsContent>

      <TabsContent value="formulario_nativo">
        <NovaFonteFormularioForm eventos={eventos} />
      </TabsContent>
    </Tabs>
  );
}
