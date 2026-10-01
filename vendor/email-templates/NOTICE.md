# Third-party email template sources

Nothing in `colorlib/` or `mailteorite/` is shipped by the running app —
those files are reference only. CodedMails MJML in `codedmails/` **is**
loaded at render time: the injector fills MaxReach copy into the original
layout.

Refresh Colorlib / Mailteorite with `node scripts/vendor-templates.mjs`.
Refresh CodedMails with `node scripts/vendor-codedmails.mjs`.

## Included

| Directory | Source | License | Files | Used at runtime |
| --- | --- | --- | --- | --- |
| `colorlib/` | [ColorlibHQ/email-templates](https://github.com/ColorlibHQ/email-templates) | MIT | 28 MJML | Structure only (see below) |
| `mailteorite/` | [Mailteorite/mjml-email-templates](https://github.com/Mailteorite/mjml-email-templates) | MIT | 14 MJML | Reference only |
| `codedmails/` | [CodedMails](https://codedmails.com/#themes) | Commercial use allowed per FAQ; copyright Aslam Shah (`codedmails/LICENSE`) | 64 MJML | Yes — all 12 themes |

Colorlib and Mailteorite licenses permit commercial use, modification and
redistribution provided the copyright notice is retained. CodedMails terms
are recorded in `codedmails/LICENSE`.

### What was actually adapted from Colorlib

Only Colorlib's newer text-first designs (`src/21`–`src/28`) were used. The
earlier numbered templates are image-heavy 2019-era marketing layouts, and the
Mailteorite set is consumer e-commerce — neither shape suits 1:1 B2B outreach,
and the Mailteorite files hotlink images from the author's own Cloudinary
account, which we would not want in Maxpro's outbound mail.

What was taken is **structure**: masthead treatments, the kicker → headline →
lede rhythm, rule work, and the panel and numbered-list patterns. Palette, type
scale, spacing and every word of copy are Maxpro's own.

| Maxpro skin | Adapted from | Pattern taken |
| --- | --- | --- |
| `spotlight` | Colorlib `src/25.mjml` | Header bar with a tag, kicker/headline stack, dark closing panel |
| `editorial` | Colorlib `src/24.mjml` | Serif masthead over a heavy rule, wide margins, rule-separated sign-off |
| `digest` | Colorlib `src/28.mjml` | Near-black canvas, accent rule under the masthead, numbered list |
| `invitation` | Colorlib `src/26.mjml` | Kicker over a large headline, practical-detail strip, single action |
| `steps` | Colorlib `src/21.mjml` | Headline and intro over a numbered sequence |
| `announcement` | Colorlib `src/27.mjml` | Solid colour band carrying the headline, quiet body beneath |

Per-template attribution also lives on the template record itself
(`EmailTemplate.source`) and is shown in the preview dialog in the app.

### CodedMails — all 12 themes, 64 templates

Pulled from the public template pages on [codedmails.com](https://codedmails.com/#themes).
There is no bulk MJML archive; `scripts/vendor-codedmails.mjs` extracts the
source embedded in each page.

Eight themes do not publish a General layout (korlavas through xyimeasi), so
the set is 12 × 5 + 4 General = **64**, matching the GitHub HTML mirror.

At render time MaxReach:

- fills headline, body, CTA and footer from generated copy
- replaces the CodedMails logo with the Maxpro wordmark
- drops relative images and social icons that would 404
- replaces receipt tables with the product's capability list

The original CodedMails palette, type and chrome are kept.

## Deliberately excluded

| Source | Reason |
| --- | --- |
| [mjmlio/email-templates](https://github.com/mjmlio/email-templates) | **No license file and no license statement in the README.** MJML the framework is MIT; this template repo is not covered by it. The templates are community submissions with no grant of rights, so they are all-rights-reserved by default and cannot be redistributed. |
| [trysurface/open-email](https://github.com/trysurface/open-email) | **No license file**, despite being described as MIT elsewhere. |
| [AndrewUru/email-designer](https://github.com/AndrewUru/email-designer) | MIT, but it is a drag-and-drop builder rather than a template source, and out of scope for now. |
| [React Email](https://react.email/templates) | Templates are React components. MaxReach renders MJML server-side; adopting these would mean a second rendering path for no gain in V1. |
