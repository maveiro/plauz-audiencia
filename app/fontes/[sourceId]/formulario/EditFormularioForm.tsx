"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/_components/ToastProvider";
import {
  updateFormularioMeta,
  updateFormularioStatus,
  savePerguntas,
  type PerguntaEditavel,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/lib/database.types";

type Formulario = Database["public"]["Tables"]["formularios"]["Row"];
type Pergunta = Database["public"]["Tables"]["formulario_perguntas"]["Row"];

const STATUS_LABELS: Record<Formulario["status"], string> = {
  rascunho: "Rascunho",
  publicado: "Publicado",
  pausado: "Pausado",
};

const TIPO_LABELS: Record<Pergunta["tipo"], string> = {
  texto_curto: "Texto curto",
  texto_longo: "Texto longo",
  multipla_escolha: "Múltipla escolha",
  caixa_selecao: "Caixa de seleção",
};

export function EditFormularioForm({
  formulario,
  perguntas,
}: {
  formulario: Formulario;
  perguntas: Pergunta[];
}) {
  const showToast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [titulo, setTitulo] = useState(formulario.titulo);
  const [descricao, setDescricao] = useState(formulario.descricao ?? "");
  const [textoConsentimento, setTextoConsentimento] = useState(formulario.texto_consentimento);
  const [textoConfirmacao, setTextoConfirmacao] = useState(formulario.texto_confirmacao ?? "");
  const [metaPixelId, setMetaPixelId] = useState(formulario.meta_pixel_id ?? "");

  const [rows, setRows] = useState<PerguntaEditavel[]>(
    perguntas.map((p) => ({
      id: p.id,
      tipo: p.tipo,
      rotulo: p.rotulo,
      obrigatorio: p.obrigatorio,
      ativo: p.ativo,
      opcoes: Array.isArray(p.opcoes) ? (p.opcoes as string[]) : null,
    })),
  );

  function updateRow(index: number, patch: Partial<PerguntaEditavel>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { id: null, tipo: "texto_curto", rotulo: "", obrigatorio: false, ativo: true, opcoes: null },
    ]);
  }

  function handleSaveMeta() {
    startTransition(async () => {
      try {
        await updateFormularioMeta(formulario.id, {
          titulo,
          descricao: descricao || null,
          textoConsentimento,
          textoConfirmacao: textoConfirmacao || null,
          metaPixelId: metaPixelId || null,
        });
        showToast("Formulário atualizado.", "success");
        router.refresh();
      } catch (err) {
        showToast(`Erro ao salvar: ${(err as Error).message}`, "error");
      }
    });
  }

  function handleChangeStatus(status: Formulario["status"]) {
    startTransition(async () => {
      try {
        await updateFormularioStatus(formulario.id, status);
        showToast(
          status === "publicado" ? "Formulário publicado." : "Status atualizado.",
          "success",
        );
        router.refresh();
      } catch (err) {
        showToast(`Erro ao atualizar status: ${(err as Error).message}`, "error");
      }
    });
  }

  function handleSavePerguntas() {
    startTransition(async () => {
      try {
        await savePerguntas(formulario.id, rows);
        showToast("Perguntas salvas.", "success");
        router.refresh();
      } catch (err) {
        showToast(`Erro ao salvar perguntas: ${(err as Error).message}`, "error");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <span className="text-sm font-medium">Status:</span>
        <Badge variant={formulario.status === "publicado" ? "default" : "secondary"}>
          {STATUS_LABELS[formulario.status]}
        </Badge>
        <div className="ml-auto flex gap-2">
          {formulario.status !== "publicado" && (
            <Button type="button" size="sm" disabled={isPending} onClick={() => handleChangeStatus("publicado")}>
              Publicar
            </Button>
          )}
          {formulario.status === "publicado" && (
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => handleChangeStatus("pausado")}>
              Pausar
            </Button>
          )}
          {formulario.status === "pausado" && (
            <Button type="button" size="sm" disabled={isPending} onClick={() => handleChangeStatus("publicado")}>
              Retomar
            </Button>
          )}
          {formulario.status !== "rascunho" && (
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => handleChangeStatus("rascunho")}>
              Voltar para rascunho
            </Button>
          )}
        </div>
        <a
          href={`/f/${formulario.slug}`}
          target="_blank"
          rel="noreferrer"
          className="w-full text-sm text-blue-600 underline dark:text-blue-400"
        >
          /f/{formulario.slug} — {formulario.status === "publicado" ? "abrir formulário público" : "pré-visualizar (exige login)"}
        </a>
      </div>

      <div className="flex max-w-lg flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit_titulo">Título do formulário</Label>
          <Input id="edit_titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit_descricao">Descrição</Label>
          <Textarea id="edit_descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit_consentimento">Texto de consentimento (LGPD)</Label>
          <Textarea
            id="edit_consentimento"
            rows={3}
            value={textoConsentimento}
            onChange={(e) => setTextoConsentimento(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit_confirmacao">Mensagem de confirmação (pós-envio)</Label>
          <Textarea id="edit_confirmacao" value={textoConfirmacao} onChange={(e) => setTextoConfirmacao(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit_pixel">Pixel de conversão da Meta (ID, opcional)</Label>
          <Input
            id="edit_pixel"
            placeholder="Ex: 1234567890123456"
            value={metaPixelId}
            onChange={(e) => setMetaPixelId(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Com o ID preenchido, o formulário público dispara o evento
            &quot;Lead&quot; no Pixel e na Conversions API da Meta ao ser
            enviado (requer <code>META_CONVERSIONS_API_ACCESS_TOKEN</code>{" "}
            configurado no servidor).
          </p>
        </div>
        <Button type="button" size="sm" disabled={isPending} onClick={handleSaveMeta} className="w-fit">
          Salvar
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">Perguntas extras</p>
        <p className="text-xs text-muted-foreground">
          Depois de criada, uma pergunta não pode trocar de tipo/opções —
          desative em vez de tentar reaproveitar a linha para outra coisa.
        </p>

        {rows.map((row, index) => (
          <div key={row.id ?? `new-${index}`} className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            {row.id ? (
              <Badge variant="outline">{TIPO_LABELS[row.tipo]}</Badge>
            ) : (
              <Select
                value={row.tipo}
                onValueChange={(value) =>
                  updateRow(index, {
                    tipo: value as PerguntaEditavel["tipo"],
                    opcoes: value === "multipla_escolha" || value === "caixa_selecao" ? ["", ""] : null,
                  })
                }
              >
                <SelectTrigger aria-label="Tipo" className="w-40">
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
            )}
            <Input
              placeholder="Rótulo"
              value={row.rotulo}
              onChange={(e) => updateRow(index, { rotulo: e.target.value })}
              className="min-w-[200px] flex-1"
            />
            {(row.tipo === "multipla_escolha" || row.tipo === "caixa_selecao") && !row.id && (
              <Textarea
                placeholder="Opções (uma por linha)"
                rows={2}
                value={(row.opcoes ?? []).join("\n")}
                onChange={(e) => updateRow(index, { opcoes: e.target.value.split("\n") })}
                className="w-full"
              />
            )}
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={row.obrigatorio}
                onChange={(e) => updateRow(index, { obrigatorio: e.target.checked })}
              />
              Obrigatória
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={row.ativo}
                onChange={(e) => updateRow(index, { ativo: e.target.checked })}
              />
              Ativa
            </label>
          </div>
        ))}

        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            + Adicionar pergunta
          </Button>
          <Button type="button" size="sm" disabled={isPending} onClick={handleSavePerguntas}>
            Salvar perguntas
          </Button>
        </div>
      </div>
    </div>
  );
}
