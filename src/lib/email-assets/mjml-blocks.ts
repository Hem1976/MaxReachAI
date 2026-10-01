import type { ResolvedEmailAssets } from "@/lib/email-assets/index";
import { escapeHtml } from "@/lib/templates/text";
import type { EmailTheme } from "@/lib/templates/themes";

function imageSrc(url: string): string {
  return url.replace(/"/g, "&quot;");
}

/** Maxpro logo image — used in every template. */
export function brandLogoImage(
  assets: ResolvedEmailAssets,
  options?: { width?: string; align?: string; padding?: string },
): string {
  if (!assets.brandLogoUrl) return "";
  const width = options?.width ?? "220px";
  const align = options?.align ?? "left";
  const padding = options?.padding ?? "0";
  return `<mj-image src="${imageSrc(assets.brandLogoUrl)}" alt="Maxpro Infotech" width="${width}" align="${align}" padding="${padding}" />`;
}

/** Logo masthead strip — prepended to every email layout. */
export function brandLogoHeaderBlock(
  assets: ResolvedEmailAssets,
  theme: EmailTheme,
  options?: { background?: string; width?: string; padding?: string; align?: string },
): string {
  if (!assets.brandLogoUrl) return "";
  const background = options?.background ?? theme.surface;
  const padding = options?.padding ?? "22px 32px 14px 32px";
  return `<mj-section background-color="${background}" padding="0">
      <mj-column>
        ${brandLogoImage(assets, {
          width: options?.width ?? "220px",
          align: options?.align ?? "left",
          padding,
        })}
      </mj-column>
    </mj-section>`;
}

/** Compact product visual — default for cold outreach with a light visual. */
export function productImageBlock(
  assets: ResolvedEmailAssets,
  theme: EmailTheme,
  options?: { width?: string; padding?: string },
): string {
  if (!assets.showProductImage || !assets.productImageUrl) return "";
  const width = options?.width ?? "480px";
  const padding = options?.padding ?? "8px 0 20px 0";
  return `<mj-image src="${imageSrc(assets.productImageUrl)}" alt="${escapeHtml(
    assets.productImageAlt,
  )}" width="${width}" padding="${padding}" border-radius="${theme.radius}" />`;
}

/** Product card: image + name + tagline. Template-controlled, not AI-generated. */
export function productCardBlock(
  assets: ResolvedEmailAssets,
  theme: EmailTheme,
  productName: string,
  tagline: string,
): string {
  if (!assets.showProductCard || !assets.productImageUrl) return "";
  const heading = theme.ink;
  return `<mj-section background-color="${theme.surface}" padding="12px 32px 8px 32px">
      <mj-column background-color="${theme.panel}" border="1px solid ${theme.rule}" border-radius="${theme.radius}" padding="0">
        ${productImageBlock(assets, theme, { width: "100%", padding: "0" })}
        <mj-text font-size="16px" font-weight="700" color="${heading}" padding="16px 22px 6px 22px">${escapeHtml(
          productName,
        )}</mj-text>
        ${
          tagline
            ? `<mj-text font-size="13px" line-height="20px" color="${theme.textMuted}" padding="0 22px 20px 22px">${escapeHtml(
                tagline,
              )}</mj-text>`
            : `<mj-spacer height="12px" />`
        }
      </mj-column>
    </mj-section>`;
}

/** Full-width hero for premium product-intro templates. */
export function heroImageBlock(
  assets: ResolvedEmailAssets,
  theme: EmailTheme,
): string {
  if (!assets.showHero || !assets.heroImageUrl) return "";
  return `<mj-section background-color="${theme.ink}" padding="0">
      <mj-column padding="0">
        <mj-image src="${imageSrc(assets.heroImageUrl)}" alt="${escapeHtml(
          assets.heroImageAlt,
        )}" width="600px" padding="0" />
      </mj-column>
    </mj-section>`;
}
