/**
 * Extrai o sheet_id de uma URL de planilha do Google, ex:
 * https://docs.google.com/spreadsheets/d/1a2b3c.../edit#gid=0 -> "1a2b3c..."
 */
export function extractSheetId(sheetUrl: string): string | null {
  const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}
