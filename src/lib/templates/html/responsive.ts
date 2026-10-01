/**
 * Shared responsive rules for HTML email templates.
 * Breakpoints align with the campaign editor: Desktop (fluid up to 640px),
 * Tablet (768px preview), Mobile (320px preview).
 */

export const EMAIL_RESPONSIVE_MARKER = "data-mx-responsive";

export const EMAIL_RESPONSIVE_STYLE_BLOCK = `<style ${EMAIL_RESPONSIVE_MARKER}>
html,body{margin:0!important;padding:0!important;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
body{font-family:Arial,Helvetica,sans-serif;color:#000000;background:#ffffff}
table{border-spacing:0;border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0}
img{border:0;display:block;height:auto;max-width:100%!important}
a{color:inherit;word-wrap:break-word;overflow-wrap:anywhere}
.mx-shell{width:100%!important;max-width:640px!important}
.mx-body-pad{padding:32px 12px!important}
.mx-content{padding:42px 40px!important}
.mx-logo-pad{padding:0 8px 16px!important}
.mx-headline{margin:20px 0 16px;font-size:38px;line-height:1.06;letter-spacing:-1.4px;font-weight:700;color:#000000;word-wrap:break-word;overflow-wrap:anywhere}
.mx-copy{margin:0 0 16px;font-size:16px;line-height:1.75;color:#202124;word-wrap:break-word;overflow-wrap:anywhere}
.mx-title{font-size:18px;line-height:1.45;color:#000000;word-wrap:break-word;overflow-wrap:anywhere}
.mx-signature{margin-top:28px;font-size:13px;line-height:1.65;color:#5f6368;word-wrap:break-word;overflow-wrap:anywhere}
.mx-signature a{word-break:break-all;color:#20a4b8;text-decoration:none}
.mx-footer{padding:16px 8px!important;font-size:10px;line-height:1.5;color:#5f6368;word-wrap:break-word;overflow-wrap:anywhere}
.mx-cta{margin:24px 0 0!important}
.mx-cta a{display:inline-block;max-width:100%;box-sizing:border-box;color:#ffffff!important;background:#20a4b8;text-decoration:none;font-weight:bold;border-radius:4px;padding:14px 22px;font-size:14px;line-height:1.35;text-align:center}
.mx-stack .mx-col-half{display:table-cell;width:50%;vertical-align:top;padding:0!important}
.mx-stack img{width:100%!important;height:auto!important;border:0;display:block}
.mx-duo-stack .mx-duo-col{display:table-cell;width:48%;vertical-align:top}
.mx-duo-spacer{display:table-cell;width:4%;font-size:0;line-height:0}
.shell,.mx-shell-600{width:100%!important;max-width:640px!important;min-width:0!important}
.hero-title,.mx-headline-serif{word-wrap:break-word;overflow-wrap:anywhere}
.section-title{word-wrap:break-word;overflow-wrap:anywhere}

@media screen and (max-width:768px){
  .mx-body-pad{padding:24px 14px!important}
  .mx-content{padding:32px 24px!important}
  .mx-headline{font-size:32px!important;line-height:1.08!important;letter-spacing:-1px!important}
  .pad{padding-left:22px!important;padding-right:22px!important}
  .hero-title{font-size:36px!important;line-height:1.05!important}
  .section-title{font-size:26px!important;line-height:1.1!important}
}

@media screen and (max-width:480px){
  .mx-body-pad{padding:14px 8px!important}
  .mx-content{padding:22px 16px!important}
  .mx-logo-pad{padding:0 4px 12px!important}
  .mx-headline{font-size:26px!important;line-height:1.12!important;letter-spacing:-0.5px!important;margin:14px 0 12px!important}
  .mx-copy{font-size:15px!important;line-height:1.7!important}
  .mx-title{font-size:16px!important}
  .mx-signature{font-size:12px!important}
  .mx-footer{font-size:10px!important;padding:12px 6px!important}
  .mx-stack,.mx-stack tbody,.mx-stack tr{display:block!important;width:100%!important;max-width:100%!important}
  .mx-stack .mx-col-half{display:block!important;width:100%!important;max-width:100%!important}
  .mx-duo-stack,.mx-duo-stack tbody,.mx-duo-stack tr{display:block!important;width:100%!important;max-width:100%!important}
  .mx-duo-stack .mx-duo-col,.mx-duo-spacer{display:block!important;width:100%!important;max-width:100%!important}
  .mx-duo-spacer{height:14px!important}
  .mx-cta,.mx-cta tbody,.mx-cta tr,.mx-cta td{display:block!important;width:100%!important;max-width:100%!important}
  .mx-cta a{display:block!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important}
  .pad{padding-left:16px!important;padding-right:16px!important}
  .hero-title{font-size:30px!important;line-height:1.08!important}
  .section-title{font-size:22px!important;line-height:1.12!important}
}
</style>`;

/** Inject shared responsive CSS once into an email HTML document. */
export function ensureResponsiveEmailHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return html;
  if (trimmed.includes(EMAIL_RESPONSIVE_MARKER)) return html;

  if (/<\/head>/i.test(trimmed)) {
    return trimmed.replace(/<\/head>/i, `${EMAIL_RESPONSIVE_STYLE_BLOCK}</head>`);
  }

  if (/<head[\s>]/i.test(trimmed)) {
    return trimmed.replace(/<head([^>]*)>/i, `<head$1>${EMAIL_RESPONSIVE_STYLE_BLOCK}`);
  }

  if (/<html[\s>]/i.test(trimmed)) {
    return trimmed.replace(
      /<html([^>]*)>/i,
      `<html$1><head>${EMAIL_RESPONSIVE_STYLE_BLOCK}</head>`,
    );
  }

  return `<!doctype html><html><head>${EMAIL_RESPONSIVE_STYLE_BLOCK}</head><body>${trimmed}</body></html>`;
}
