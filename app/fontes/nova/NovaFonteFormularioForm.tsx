"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFormularioSource } from "../actions";
import { slugify } from "@/lib/formularios/slugify";
import { TEXTO_CONSENTIMENTO_PADRAO } from "@/lib/formularios/camposPadrao";
import type { NovaPerguntaInput } from "@/lib/formularios/criarFormulario";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TIPO_LABELS: Record<NovaPerguntaInput["tipo"], string> = {
  texto_curto: "Texto curto",
  texto_longo: "Texto longo",
  multipla_escolha: "Múltipla escolha (uma opção)",
  caixa_selecao: "Caixa de seleção (várias opções)",
};

export function NovaFonteFormularioForm({
  eventos,
}: {
  eventos: { id: string; label: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  const [eventoId, setEventoId] = useState("");
  const [name, setName] = useState("");
  const [titulo, setTitulo] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEditadoManualmente, setSlugEditadoManualmente] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [textoConsentimento, setTextoConsentimento] = useState(TEXTO_CONSENTIMENTO_PADRAO);
  const [perguntas, setPerguntas] = useState<NovaPerguntaInput[]>([]);

  function handleTituloChange(value: string) {
    setTitulo(value);
    if (!slugEditadoManualmente) {
      setSlug(slugify(value));
    }
  }

  function addPergunta() {
    setPerguntas((prev) => [
      ...prev,
      { tipo: "texto_curto", rotulo: "", obrigatorio: false, opcoes: null },
    ]);
  }

  function updatePergunta(index: number, patch: Partial<NovaPerguntaInput>) {
    setPerguntas((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function removePergunta(index: number) {
    setPerguntas((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    const perguntasInvalidas = perguntas.some(
      (p) =>
        !p.rotulo.trim() ||
        ((p.tipo === "multipla_escolha" || p.tipo === "caixa_selecao") &&
          (!p.opcoes || p.opcoes.filter((o) => o.trim()).length < 2)),
    );
    if (perguntasInvalidas) {
      setErrorMessage(
        "Toda pergunta extra precisa de um rótulo, e perguntas de múltipla escolha/caixa de seleção precisam de ao menos 2 opções.",
      );
      return;
    }

    startTransition(async () => {
      try {
        const { sourceId } = await createFormularioSource({
          eventoId,
          name,
          slug,
          titulo,
          descricao: descricao || null,
          textoConsentimento,
          perguntas: perguntas.map((p) => ({
            ...p,
            opcoes: p.opcoes ? p.opcoes.filter((o) => o.trim()) : null,
          })),
        });
        router.push(`/fontes/${sourceId}/formulario`);
      } catch (err) {
        setErrorMessage((err as Error).message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="formulario_evento_id">Evento</Label>
        <Select value={eventoId} onValueChange={setEventoId} required>
          <SelectTrigger id="formulario_evento_id" className="w-full">
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
        <Label htmlFor="formulario_name">Nome da fonte (uso interno)</Label>
        <Input
          id="formulario_name"
          required
          placeholder="Ex: Formulário de captação"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="formulario_titulo">Título do formulário (visível ao público)</Label>
        <Input
          id="formulario_titulo"
          required
          placeholder="Ex: Quero garantir meu ingresso"
          value={titulo}
          onChange={(e) => handleTituloChange(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="formulario_slug">Endereço do formulário</Label>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <span className="whitespace-nowrap">/f/</span>
          <Input
            id="formulario_slug"
            required
            pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
            minLength={3}
            maxLength={60}
            value={slug}
            onChange={(e) => {
              setSlugEditadoManualmente(true);
              setSlug(e.target.value);
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="formulario_descricao">Descrição (opcional)</Label>
        <Textarea
          id="formulario_descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="formulario_consentimento">Texto de consentimento (LGPD)</Label>
        <Textarea
          id="formulario_consentimento"
          required
          rows={3}
          value={textoConsentimento}
          onChange={(e) => setTextoConsentimento(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <p className="text-sm font-medium">Perguntas extras (opcional)</p>
        <p className="text-xs text-muted-foreground">
          Nome, e-mail, telefone e cidade/estado já fazem parte do
          formulário automaticamente — adicione aqui só perguntas extras
          específicas deste evento.
        </p>

        {perguntas.map((pergunta, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Rótulo da pergunta"
                value={pergunta.rotulo}
                onChange={(e) => updatePergunta(index, { rotulo: e.target.value })}
                className="min-w-[200px] flex-1"
              />
              <Select
                value={pergunta.tipo}
                onValueChange={(value) =>
                  updatePergunta(index, {
                    tipo: value as NovaPerguntaInput["tipo"],
                    opcoes:
                      value === "multipla_escolha" || value === "caixa_selecao" ? ["", ""] : null,
                  })
                }
              >
                <SelectTrigger aria-label="Tipo de pergunta">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={pergunta.obrigatorio}
                  onChange={(e) => updatePergunta(index, { obrigatorio: e.target.checked })}
                />
                Obrigatória
              </label>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="text-destructive"
                onClick={() => removePergunta(index)}
              >
                remover
              </Button>
            </div>

            {(pergunta.tipo === "multipla_escolha" || pergunta.tipo === "caixa_selecao") && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Opções (uma por linha)
                </Label>
                <Textarea
                  rows={3}
                  value={(pergunta.opcoes ?? []).join("\n")}
                  onChange={(e) =>
                    updatePergunta(index, { opcoes: e.target.value.split("\n") })
                  }
                />
              </div>
            )}
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" onClick={addPergunta} className="w-fit">
          + Adicionar pergunta
        </Button>
      </div>

      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Criando..." : "Criar formulário"}
      </Button>
    </form>
  );
}
