/** Extracts the text a recipient would actually see from rendered email HTML. */

const ENTITIES = {
  "&#39;": "'",
  "&quot;": '"',
  "&nbsp;": " ",
  "&bull;": "*",
  "&middot;": "·",
  "&lt;": "<",
  "&gt;": ">",
  // Must run last: decoding it earlier would corrupt the entities above.
  "&amp;": "&",
};

export function visibleText(html) {
  let out = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, "\n");

  for (const [entity, char] of Object.entries(ENTITIES)) {
    out = out.split(entity).join(char);
  }

  return out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}
