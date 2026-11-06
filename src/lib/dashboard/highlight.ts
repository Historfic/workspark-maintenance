function canonicalChar(char: string): string {
  if (char === "‘" || char === "’" || char === "‛") return "'";
  if (char === "“" || char === "”") return '"';
  return char.toLowerCase();
}

// Maps each canonical character back to its index in the original text so a match can be
// translated into an exact slice of the original.
function canonicalize(text: string): { canonical: string; indexMap: number[] } {
  let canonical = "";
  const indexMap: number[] = [];
  let lastWasSpace = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] ?? "";
    if (/\s/.test(char)) {
      if (lastWasSpace) continue;
      lastWasSpace = true;
      canonical += " ";
      indexMap.push(i);
      continue;
    }
    lastWasSpace = false;
    canonical += canonicalChar(char);
    indexMap.push(i);
  }
  return { canonical, indexMap };
}

export function quoteRange(
  text: string,
  quote: string | null,
): { start: number; end: number } | null {
  if (quote === null) return null;
  const needle = canonicalize(quote).canonical.trim();
  if (needle.length === 0) return null;
  const { canonical, indexMap } = canonicalize(text);
  const at = canonical.indexOf(needle);
  if (at === -1) return null;
  const start = indexMap[at];
  const lastIndex = indexMap[at + needle.length - 1];
  if (start === undefined || lastIndex === undefined) return null;
  return { start, end: lastIndex + 1 };
}
