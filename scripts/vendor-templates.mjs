/**
 * Pulls the MIT-licensed MJML template sources we reference into `vendor/`.
 *
 * Only sources with a license that actually permits redistribution are listed
 * here — see vendor/email-templates/NOTICE.md for the ones we deliberately
 * left out.
 *
 *   node scripts/vendor-templates.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ROOT = join(process.cwd(), "vendor", "email-templates");

const SOURCES = [
  {
    dir: "colorlib",
    repo: "ColorlibHQ/email-templates",
    ref: "master",
    keep: (p) => p === "LICENSE-MIT" || /^src\/.+\.mjml$/.test(p),
  },
  {
    dir: "mailteorite",
    repo: "Mailteorite/mjml-email-templates",
    ref: "main",
    keep: (p) => p === "LICENSE" || /^mjml\/.+\.mjml$/.test(p),
  },
];

/** raw.githubusercontent rate-limits bursts with a 503, so back off and retry. */
async function get(url) {
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(url, { headers: { "User-Agent": "maxreach-vendor" } });
    if (res.ok) return res;
    if (attempt >= 5 || res.status < 500) {
      throw new Error(`${res.status} ${res.statusText} for ${url}`);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
  }
}

async function api(url) {
  const res = await get(url);
  return res.json();
}

async function vendor(source) {
  const tree = await api(
    `https://api.github.com/repos/${source.repo}/git/trees/${source.ref}?recursive=1`,
  );
  const files = tree.tree.filter((n) => n.type === "blob" && source.keep(n.path));

  let bytes = 0;
  for (const file of files) {
    const raw = `https://raw.githubusercontent.com/${source.repo}/${source.ref}/${file.path}`;
    const body = await (await get(raw)).text();
    const target = join(ROOT, source.dir, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body, "utf8");
    bytes += Buffer.byteLength(body);
  }

  console.log(
    `${source.dir.padEnd(14)} ${String(files.length).padStart(3)} files  ${(bytes / 1024).toFixed(0)} KB  (${source.repo}@${source.ref})`,
  );
}

for (const source of SOURCES) {
  await vendor(source);
}
