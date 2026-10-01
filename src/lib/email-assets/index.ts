import type { Product, ProductId } from "@/lib/types";
import type { TemplateImageSettings } from "@/lib/templates/types";

/** Paths under `public/`. Production HTML uses EMAIL_ASSET_BASE_URL. */
export const BRAND_ASSETS = {
  logo: "/email-assets/maxpro-logo.svg",
  logoLight: "/email-assets/maxpro-logo-light.svg",
} as const;

const PRODUCT_IMAGE_FILES: Record<ProductId, string> = {
  rockey: "rockey.jpg",
  "rocketsales-pharma": "rocket-sales-pharma.jpg",
  "rocketorder-ai": "rocket-order-ai.jpg",
  "rockey-agro": "rockey-agro.jpg",
  rocketdelivery: "rocket-delivery.jpg",
  rocketbot: "rocketbot.jpg",
  rocketbi: "rocketbi.jpg",
  "rocketdox-ai": "rocketdox-ai.jpg",
  rocketbiz: "rocketbiz.jpg",
};

const HERO_FILES = {
  hero01: "hero-01.jpg",
  hero02: "hero-02.jpg",
  pattern01: "pattern-01.png",
} as const;

export function productImagePath(productId: ProductId): string {
  return `/email-assets/products/${PRODUCT_IMAGE_FILES[productId]}`;
}

export function heroImagePath(key: keyof typeof HERO_FILES = "hero01"): string {
  return `/email-assets/templates/${HERO_FILES[key]}`;
}

/** Public HTTPS base for outbound email. Empty = relative paths (local preview). */
export function getEmailAssetBaseUrl(): string {
  const raw =
    process.env.EMAIL_ASSET_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_EMAIL_ASSET_BASE_URL?.trim() ||
    "";
  return raw.replace(/\/$/, "");
}

export function resolveAssetUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = getEmailAssetBaseUrl();
  return base ? `${base}${normalized}` : normalized;
}

export interface ResolvedEmailAssets {
  brandLogoUrl: string;
  productImageUrl: string | null;
  productImageAlt: string;
  heroImageUrl: string | null;
  heroImageAlt: string;
  showProductImage: boolean;
  showProductCard: boolean;
  showHero: boolean;
}

const NO_IMAGES: TemplateImageSettings = {
  imageMode: "none",
  showProductCard: false,
  showHero: false,
};

export function templateImageSettings(
  template?: { imageSettings?: TemplateImageSettings },
): TemplateImageSettings {
  return template?.imageSettings ?? NO_IMAGES;
}

/** Maps product + template flags to absolute asset URLs. No AI involvement. */
export function resolveEmailAssets(input: {
  product?: Product | null;
  template?: { imageSettings?: TemplateImageSettings };
}): ResolvedEmailAssets {
  const settings = templateImageSettings(input.template);
  const product = input.product ?? null;

  const productPath = product
    ? product.image ?? productImagePath(product.id)
    : null;
  const productImageAlt = product?.imageAlt ?? product?.name ?? "Maxpro product";

  const showProductImage =
    settings.imageMode !== "none" && Boolean(productPath);
  const showProductCard = settings.showProductCard && showProductImage;
  const showHero = settings.showHero && settings.imageMode === "hero";

  const heroKey = settings.heroKey ?? "hero01";
  const heroPath = showHero ? heroImagePath(heroKey) : null;

  return {
    brandLogoUrl: resolveAssetUrl(BRAND_ASSETS.logo),
    productImageUrl: showProductImage && productPath
      ? resolveAssetUrl(productPath)
      : null,
    productImageAlt,
    heroImageUrl: heroPath ? resolveAssetUrl(heroPath) : null,
    heroImageAlt: product?.name
      ? `${product.name} — Maxpro Infotech`
      : "Maxpro Infotech",
    showProductImage,
    showProductCard,
    showHero,
  };
}
