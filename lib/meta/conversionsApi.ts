import "server-only";
import { createHash } from "node:crypto";

const GRAPH_API_VERSION = "v21.0";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Exigência da Meta: e-mail em hash SHA-256, normalizado (trim + lowercase). */
export function hashEmailParaMeta(email: string): string {
  return sha256(email.trim().toLowerCase());
}

/** Exigência da Meta: telefone só dígitos, com DDI, em hash SHA-256. */
export function hashTelefoneParaMeta(telefoneDigits: string): string {
  const comDDI = telefoneDigits.startsWith("55") ? telefoneDigits : `55${telefoneDigits}`;
  return sha256(comDDI);
}

/**
 * Formato exigido pela Meta pro parâmetro `fbc` quando reconstruído a
 * partir do `fbclid` da URL (em vez de lido direto do cookie `_fbc`):
 * `fb.1.{timestamp_ms}.{fbclid}`. Sem o cookie `_fbc` original, usamos o
 * horário da submissão como aproximação do horário do clique — sub-ótimo,
 * mas melhor que omitir o parâmetro (afeta match quality, não corretude).
 */
export function buildFbcFromClickId(fbclid: string, timestampMs: number = Date.now()): string {
  return `fb.1.${timestampMs}.${fbclid}`;
}

export interface EnviarLeadCapiInput {
  pixelId: string;
  eventId: string;
  eventSourceUrl: string;
  email: string;
  telefoneDigits: string | null;
  fbp: string | null;
  fbc: string | null;
  ip: string | null;
  userAgent: string | null;
  utm: {
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    utmContent?: string | null;
  };
}

export interface EnviarLeadCapiResult {
  enviado: boolean;
  respostaMeta?: unknown;
  erro?: string;
}

/**
 * Chamada best-effort à Conversions API da Meta (PRD, "Meta Pixel +
 * Conversions API — desenho técnico"): nunca lança — sempre devolve um
 * resultado pra ser logado em `meta_capi_logs`, sucesso ou erro. Falha
 * aqui nunca pode derrubar a submissão do lead, que já foi salva antes
 * desta chamada ser sequer disparada.
 *
 * `eventId` precisa ser o mesmo enviado ao Pixel client-side
 * (`fbq('track', 'Lead', ..., {eventID})`) — é essa correlação que permite
 * ao Meta deduplicar o mesmo evento reportado duas vezes.
 */
export async function enviarLeadParaConversionsApi(
  input: EnviarLeadCapiInput,
): Promise<EnviarLeadCapiResult> {
  const accessToken = process.env.META_CONVERSIONS_API_ACCESS_TOKEN;
  if (!accessToken) {
    return { enviado: false, erro: "META_CONVERSIONS_API_ACCESS_TOKEN não configurado." };
  }

  const userData: Record<string, unknown> = {
    em: [hashEmailParaMeta(input.email)],
  };
  if (input.telefoneDigits) userData.ph = [hashTelefoneParaMeta(input.telefoneDigits)];
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;
  if (input.ip) userData.client_ip_address = input.ip;
  if (input.userAgent) userData.client_user_agent = input.userAgent;

  const customData: Record<string, string> = {};
  if (input.utm.utmSource) customData.utm_source = input.utm.utmSource;
  if (input.utm.utmMedium) customData.utm_medium = input.utm.utmMedium;
  if (input.utm.utmCampaign) customData.utm_campaign = input.utm.utmCampaign;
  if (input.utm.utmContent) customData.utm_content = input.utm.utmContent;

  const testEventCode = process.env.META_PIXEL_TEST_EVENT_CODE;

  const payload = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        event_source_url: input.eventSourceUrl,
        user_data: userData,
        ...(Object.keys(customData).length > 0 ? { custom_data: customData } : {}),
      },
    ],
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${input.pixelId}/events?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const erro =
        json && typeof json === "object" && "error" in json
          ? String((json as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`)
          : `HTTP ${res.status}`;
      return { enviado: false, respostaMeta: json, erro };
    }
    return { enviado: true, respostaMeta: json };
  } catch (err) {
    return { enviado: false, erro: (err as Error).message };
  }
}
