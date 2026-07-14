"use client";

import { useState } from "react";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { FormularioPublico as FormularioPublicoData } from "@/lib/formularios/getFormularioPorSlug";

const HONEYPOT_KEY = "empresa_site";

type Respostas = Record<string, string | string[]>;

type FbqFn = (...args: unknown[]) => void;

function dispararLeadNoPixel(eventId: string) {
  const fbq = (window as unknown as { fbq?: FbqFn }).fbq;
  if (typeof fbq === "function") {
    fbq("track", "Lead", {}, { eventID: eventId });
  }
}

export function FormularioPublico({
  slug,
  formulario,
  preview,
}: {
  slug: string;
  formulario: FormularioPublicoData;
  preview: boolean;
}) {
  const [loadedAt] = useState(() => Date.now());
  const [respostas, setRespostas] = useState<Respostas>({
    nome: "",
    telefone: "",
    email: "",
    cidade: "",
    estado: "",
  });
  const [consentimento, setConsentimento] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [eventId] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  function setCampo(chave: string, valor: string) {
    setRespostas((prev) => ({ ...prev, [chave]: valor }));
  }

  function toggleCaixaSelecao(chave: string, opcao: string, marcado: boolean) {
    setRespostas((prev) => {
      const atual = Array.isArray(prev[chave]) ? (prev[chave] as string[]) : [];
      const novo = marcado ? [...atual, opcao] : atual.filter((v) => v !== opcao);
      return { ...prev, [chave]: novo };
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (preview) return;
    if (!consentimento) {
      setErrorMessage("É necessário aceitar o termo de consentimento para continuar.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const params = new URLSearchParams(window.location.search);
    const honeypotEl = (e.currentTarget.elements.namedItem(HONEYPOT_KEY) as HTMLInputElement | null);

    try {
      const res = await fetch(`/api/f/${slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          respostas,
          loadedAt,
          eventId,
          [HONEYPOT_KEY]: honeypotEl?.value ?? "",
          utm: {
            utm_source: params.get("utm_source") ?? "",
            utm_medium: params.get("utm_medium") ?? "",
            utm_campaign: params.get("utm_campaign") ?? "",
            utm_content: params.get("utm_content") ?? "",
            fbclid: params.get("fbclid") ?? "",
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error ?? "Não foi possível enviar. Tente novamente.");
        return;
      }
      if (!data.duplicated && formulario.metaPixelId) {
        dispararLeadNoPixel(eventId);
      }
      setEnviado(true);
    } catch {
      setErrorMessage("Não foi possível enviar. Verifique sua conexão e tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const pixelScript = formulario.metaPixelId && (
    <Script id="meta-pixel-base" strategy="afterInteractive">
      {`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${formulario.metaPixelId}');
        fbq('track', 'PageView');
      `}
    </Script>
  );

  if (enviado) {
    return (
      <>
        {pixelScript}
        <div className="flex flex-col items-center gap-2 rounded-lg border border-zinc-200 p-6 text-center dark:border-zinc-800">
          <h1 className="text-lg font-semibold">Prontinho!</h1>
          <p className="text-sm text-muted-foreground">
            {formulario.textoConfirmacao ||
              "Recebemos seu interesse! Fique de olho no seu e-mail e WhatsApp para novidades sobre o evento."}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {pixelScript}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">{formulario.titulo}</h1>
        {formulario.descricao && (
          <p className="mt-1 text-sm text-muted-foreground">{formulario.descricao}</p>
        )}
      </div>

      {/* Honeypot: escondido de humanos via CSS, bots preenchem porque veem
          o campo no DOM. Nunca usar display:none puro em alguns casos pode
          ser ignorado por bots mais sofisticados, mas offscreen + tabIndex
          -1 cobre a esmagadora maioria dos bots simples de formulário. */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor={HONEYPOT_KEY}>Empresa</label>
        <input id={HONEYPOT_KEY} name={HONEYPOT_KEY} type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nome">Nome completo</Label>
        <Input
          id="nome"
          required
          maxLength={500}
          value={respostas.nome as string}
          onChange={(e) => setCampo("nome", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          required
          maxLength={500}
          value={respostas.email as string}
          onChange={(e) => setCampo("email", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="telefone">Telefone (WhatsApp)</Label>
        <Input
          id="telefone"
          type="tel"
          required
          maxLength={30}
          placeholder="(00) 00000-0000"
          value={respostas.telefone as string}
          onChange={(e) => setCampo("telefone", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cidade">Cidade</Label>
          <Input
            id="cidade"
            required
            maxLength={200}
            value={respostas.cidade as string}
            onChange={(e) => setCampo("cidade", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="estado">Estado</Label>
          <Input
            id="estado"
            required
            maxLength={2}
            placeholder="UF"
            value={respostas.estado as string}
            onChange={(e) => setCampo("estado", e.target.value.toUpperCase())}
          />
        </div>
      </div>

      {formulario.perguntas.map((pergunta) => (
        <div key={pergunta.id} className="flex flex-col gap-1.5">
          <Label htmlFor={pergunta.chave}>
            {pergunta.rotulo}
            {!pergunta.obrigatorio && (
              <span className="ml-1 text-xs text-muted-foreground">(opcional)</span>
            )}
          </Label>

          {pergunta.tipo === "texto_curto" && (
            <Input
              id={pergunta.chave}
              required={pergunta.obrigatorio}
              maxLength={500}
              value={(respostas[pergunta.chave] as string) ?? ""}
              onChange={(e) => setCampo(pergunta.chave, e.target.value)}
            />
          )}

          {pergunta.tipo === "texto_longo" && (
            <Textarea
              id={pergunta.chave}
              required={pergunta.obrigatorio}
              maxLength={5000}
              value={(respostas[pergunta.chave] as string) ?? ""}
              onChange={(e) => setCampo(pergunta.chave, e.target.value)}
            />
          )}

          {pergunta.tipo === "multipla_escolha" && (
            <RadioGroup
              value={(respostas[pergunta.chave] as string) ?? ""}
              onValueChange={(value) => setCampo(pergunta.chave, value)}
            >
              {(pergunta.opcoes ?? []).map((opcao) => (
                <div key={opcao} className="flex items-center gap-2">
                  <RadioGroupItem value={opcao} id={`${pergunta.chave}-${opcao}`} />
                  <Label htmlFor={`${pergunta.chave}-${opcao}`} className="font-normal">
                    {opcao}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {pergunta.tipo === "caixa_selecao" && (
            <div className="flex flex-col gap-2">
              {(pergunta.opcoes ?? []).map((opcao) => {
                const selecionadas = Array.isArray(respostas[pergunta.chave])
                  ? (respostas[pergunta.chave] as string[])
                  : [];
                return (
                  <div key={opcao} className="flex items-center gap-2">
                    <Checkbox
                      id={`${pergunta.chave}-${opcao}`}
                      checked={selecionadas.includes(opcao)}
                      onCheckedChange={(checked) =>
                        toggleCaixaSelecao(pergunta.chave, opcao, checked === true)
                      }
                    />
                    <Label htmlFor={`${pergunta.chave}-${opcao}`} className="font-normal">
                      {opcao}
                    </Label>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      <div className="flex items-start gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <Checkbox
          id="consentimento"
          checked={consentimento}
          onCheckedChange={(checked) => setConsentimento(checked === true)}
          className="mt-0.5"
        />
        <Label htmlFor="consentimento" className="text-xs font-normal text-muted-foreground">
          {formulario.textoConsentimento}
        </Label>
      </div>

      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

      <Button type="submit" disabled={isSubmitting || preview}>
        {isSubmitting ? "Enviando..." : preview ? "Envio desativado (pré-visualização)" : "Enviar"}
      </Button>
    </form>
    </>
  );
}
