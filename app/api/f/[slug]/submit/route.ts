import { NextRequest, NextResponse, after } from "next/server";
import { randomUUID } from "node:crypto";
import { getFormularioPorSlug } from "@/lib/formularios/getFormularioPorSlug";
import { validarResposta } from "@/lib/formularios/validarResposta";
import { submitFormResponse } from "@/lib/sync/submitFormResponse";
import { UTM_ROW_KEYS } from "@/lib/formularios/constants";
import { enviarLeadParaConversionsApi, buildFbcFromClickId } from "@/lib/meta/conversionsApi";
import { createServiceRoleClient } from "@/lib/supabase/server";

// Bot preenche este campo (visualmente escondido no client, nunca mostrado
// a humano) — se vier preenchido, é sinal de submissão automatizada.
const HONEYPOT_KEY = "empresa_site";
// Abaixo deste tempo entre carregar a página e enviar, tratamos como bot
// (heurística barata, não uma barreira — forjável pelo client, mas filtra o
// spam automatizado mais simples sem exigir CAPTCHA).
const TEMPO_MINIMO_MS = 2000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const payload = body as Record<string, unknown>;

  const formulario = await getFormularioPorSlug(slug);
  if (!formulario || formulario.status !== "publicado") {
    // Não vazar se o slug existe mas está em rascunho/pausado — mesma
    // resposta de "não encontrado" pros dois casos.
    return NextResponse.json({ error: "Formulário não encontrado." }, { status: 404 });
  }

  const eventId = typeof payload.eventId === "string" && payload.eventId ? payload.eventId : randomUUID();

  // Honeypot preenchido ou tempo de preenchimento implausível: resposta de
  // sucesso falsa, sem gravar nada — não ensina o bot a se ajustar.
  const honeypot = typeof payload[HONEYPOT_KEY] === "string" ? (payload[HONEYPOT_KEY] as string) : "";
  const loadedAt = typeof payload.loadedAt === "number" ? payload.loadedAt : 0;
  const tempoDecorrido = Date.now() - loadedAt;
  if (honeypot.trim() !== "" || !loadedAt || tempoDecorrido < TEMPO_MINIMO_MS) {
    return NextResponse.json({ ok: true, duplicated: false, eventId });
  }

  const validacao = validarResposta(formulario, payload.respostas);
  if (!validacao.ok) {
    return NextResponse.json({ error: validacao.error }, { status: 400 });
  }

  const row = validacao.row;
  const utm = typeof payload.utm === "object" && payload.utm !== null ? (payload.utm as Record<string, unknown>) : {};
  for (const key of UTM_ROW_KEYS) {
    const value = utm[key.replace(/^_/, "")];
    if (typeof value === "string" && value.trim()) {
      row[key] = value.trim().slice(0, 200);
    }
  }

  try {
    const result = await submitFormResponse(formulario.sourceId, row);

    if (!result.duplicated && result.interessadoId && formulario.metaPixelId) {
      // after() garante que a resposta ao usuário não espera a chamada à
      // Meta — o lead já foi salvo acima, uma falha aqui nunca pode
      // derrubar a submissão (PRD, "não bloquear a resposta ao usuário").
      after(() =>
        dispararConversionsApi({
          interessadoId: result.interessadoId!,
          pixelId: formulario.metaPixelId!,
          eventId,
          request,
          slug,
          respostas: row,
        }),
      );
    }

    return NextResponse.json({ ok: true, duplicated: result.duplicated, eventId });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

async function dispararConversionsApi(args: {
  interessadoId: string;
  pixelId: string;
  eventId: string;
  request: NextRequest;
  slug: string;
  respostas: Record<string, string>;
}) {
  const { interessadoId, pixelId, eventId, request, slug, respostas } = args;

  const fbp = request.cookies.get("_fbp")?.value ?? null;
  const fbclid = respostas._fbclid;
  const fbc = request.cookies.get("_fbc")?.value ?? (fbclid ? buildFbcFromClickId(fbclid) : null);
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;
  const userAgent = request.headers.get("user-agent");
  const eventSourceUrl =
    request.headers.get("referer") ?? `${request.nextUrl.origin}/f/${slug}`;

  const resultado = await enviarLeadParaConversionsApi({
    pixelId,
    eventId,
    eventSourceUrl,
    email: respostas.email,
    telefoneDigits: respostas.telefone ? respostas.telefone.replace(/\D/g, "") : null,
    fbp,
    fbc,
    ip,
    userAgent,
    utm: {
      utmSource: respostas._utm_source,
      utmMedium: respostas._utm_medium,
      utmCampaign: respostas._utm_campaign,
      utmContent: respostas._utm_content,
    },
  });

  const supabase = createServiceRoleClient();
  await supabase.from("meta_capi_logs").insert({
    interessado_id: interessadoId,
    event_id: eventId,
    enviado: resultado.enviado,
    resposta_meta: resultado.respostaMeta ? JSON.parse(JSON.stringify(resultado.respostaMeta)) : null,
    erro: resultado.erro ?? null,
  });
}
