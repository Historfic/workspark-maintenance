export const MAX_REPORT_CHARS = 2000;
export const MAX_TRANSCRIPT_CHARS = 8000;

export type NormalizeResult =
  { ok: true; text: string } | { ok: false; reason: "empty" | "too_long" };

function isControl(char: string): boolean {
  const code = char.charCodeAt(0);
  return (code < 32 && char !== "\n" && char !== "\t") || code === 127;
}

export function normalizeReportText(raw: string, maxChars: number): NormalizeResult {
  const text = [...raw.normalize("NFC").replace(/\r\n?/g, "\n")]
    .filter((char) => !isControl(char))
    .join("")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length === 0) return { ok: false, reason: "empty" };
  if (text.length > maxChars) return { ok: false, reason: "too_long" };
  return { ok: true, text };
}
