/**
 * Parse CSV-like string to array of entity IDs.
 * Supports comma-separated, newline-separated, or mixed.
 */
export function parseEntityIdsFromCsv(csv: string): string[] {
  const ids = csv
    .split(/[\s,;\n\r]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return [...new Set(ids)]; // dedupe
}
