import "server-only";
import { google } from "googleapis";

/**
 * Autentica com a service account (somente leitura). Nunca usar OAuth de
 * usuário aqui — ver CLAUDE.md, seção Stack.
 */
export function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let rawPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim();
  // Aspas duplas envolventes sobrevivem quando o valor é colado direto no
  // dashboard da Vercel (ali não há o unquoting que o .env.local recebe).
  if (
    rawPrivateKey &&
    rawPrivateKey.startsWith('"') &&
    rawPrivateKey.endsWith('"')
  ) {
    rawPrivateKey = rawPrivateKey.slice(1, -1);
  }
  const privateKey = rawPrivateKey?.replace(/\\n/g, "\n");

  if (!email || !privateKey) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY precisam estar definidas (ver .env.example).",
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({ version: "v4", auth });
}
