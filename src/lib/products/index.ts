import type { LeadBrief, Product, ProductId } from "@/lib/types";
import { products } from "@/lib/products/data";

export { products };

const byId = new Map<string, Product>(products.map((p) => [p.id, p]));
const byName = new Map<string, Product>(
  products.map((p) => [p.name.toLowerCase(), p]),
);

export function getProduct(id: string): Product | undefined {
  return byId.get(id);
}

export function getProductOrThrow(id: string): Product {
  const product = byId.get(id);
  if (!product) throw new Error(`Unknown Maxpro product: ${id}`);
  return product;
}

export const productOptions = products.map((p) => ({
  value: p.id,
  label: p.name,
  category: p.category,
}));

/**
 * Maps whatever the model wrote in `recommendedProduct` back onto a real
 * catalogue entry. Guards against the model inventing a product name.
 */
export function resolveProductName(raw: string): Product | undefined {
  const needle = raw.trim().toLowerCase();
  if (!needle) return undefined;

  const exact = byName.get(needle);
  if (exact) return exact;

  // Model output like "Maxpro RocketBi platform" should still resolve.
  return products.find(
    (p) =>
      needle.includes(p.name.toLowerCase()) ||
      p.name.toLowerCase().includes(needle),
  );
}

/**
 * Finds the product a block of copy is actually about. Used for template
 * previews, where the sample copy names the product rather than the caller.
 * Longest name first so "Rockey Agro" is not swallowed by "Rockey".
 */
const byLength = [...products].sort((a, b) => b.name.length - a.name.length);

export function findProductMention(text: string): Product | undefined {
  const haystack = text.toLowerCase();
  return byLength.find((p) => haystack.includes(p.name.toLowerCase()));
}

export interface ProductMatch {
  product: Product;
  score: number;
  matched: string[];
}

/**
 * Deterministic product recommendation. Runs before the model so the AI never
 * has to guess which product exists — it only writes copy for what we hand it.
 */
export function detectProducts(brief: {
  industry?: string;
  notes?: string;
  jobTitle?: string;
  company?: string;
  website?: string;
}): ProductMatch[] {
  const industry = normalise(brief.industry ?? "");
  const context = normalise(
    [brief.notes, brief.jobTitle, brief.company, brief.website]
      .filter(Boolean)
      .join(" "),
  );

  const matches = products.map<ProductMatch>((product) => {
    let score = 0;
    const matched: string[] = [];

    for (const industryName of product.idealIndustries) {
      const term = normalise(industryName);
      if (industry && (industry.includes(term) || term.includes(industry))) {
        score += 6;
        matched.push(industryName);
      }
    }

    for (const keyword of product.keywords) {
      if (industry.includes(keyword)) {
        score += 3;
        matched.push(keyword);
      } else if (context.includes(keyword)) {
        score += 2;
        matched.push(keyword);
      }
    }

    for (const problem of product.problemsSolved) {
      const salient = keyTerms(problem);
      const hits = salient.filter((term) => context.includes(term));
      if (hits.length >= 2) {
        score += 2;
        matched.push(problem);
      }
    }

    return { product, score, matched: dedupe(matched) };
  });

  return matches.sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name));
}

/**
 * Picks the product knowledge that goes into the prompt.
 *
 * - explicit selection  -> that product only
 * - confident auto      -> the winning product only
 * - ambiguous auto      -> the top two, so the model can choose between real
 *                          options instead of inventing one
 */
export function selectProductsForPrompt(brief: LeadBrief): {
  candidates: Product[];
  autoDetected: boolean;
  primary: Product;
  detection: ProductMatch[];
} {
  if (brief.product !== "auto") {
    const product = getProductOrThrow(brief.product);
    return {
      candidates: [product],
      autoDetected: false,
      primary: product,
      detection: [],
    };
  }

  const detection = detectProducts(brief);
  const [best, runnerUp] = detection;

  // Nothing in the brief matched the catalogue: fall back to the core platform
  // rather than letting the model pick at random.
  if (!best || best.score === 0) {
    const fallback = getProductOrThrow("rockey");
    return {
      candidates: [fallback],
      autoDetected: true,
      primary: fallback,
      detection,
    };
  }

  const ambiguous =
    runnerUp !== undefined &&
    runnerUp.score > 0 &&
    best.score - runnerUp.score <= 2;

  return {
    candidates: ambiguous ? [best.product, runnerUp.product] : [best.product],
    autoDetected: true,
    primary: best.product,
    detection,
  };
}

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "are", "not",
  "has", "have", "was", "were", "been", "their", "them", "they", "there",
  "which", "what", "when", "where", "who", "how", "every", "each", "all",
  "any", "out", "over", "than", "then", "does", "done", "onto", "some",
]);

function keyTerms(sentence: string): string[] {
  return dedupe(
    normalise(sentence)
      .split(" ")
      .filter((word) => word.length > 3 && !STOP_WORDS.has(word)),
  );
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export type { ProductId };
