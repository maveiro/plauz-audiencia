/**
 * Carrega .env.local para scripts standalone (fora do Next.js, que já faz
 * isso automaticamente). Importar antes de qualquer módulo que leia
 * process.env.
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";

loadEnv({ path: path.join(__dirname, "..", ".env.local") });
