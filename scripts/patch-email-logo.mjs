import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const logoPath = process.argv[2] ?? "public/email-assets/maxpro-logo-final-header.png";
const b = readFileSync(logoPath);
const logoUri = `data:image/png;base64,${b.toString("base64")}`;
console.log("Logo bytes:", b.length, "data-uri chars:", logoUri.length);

const logoImg = `<img src="${logoUri}" alt="MaxPro Infotech" width="300" style="display:block;margin:0 auto 14px auto;border:0;height:auto;max-width:300px;">`;

const headerBlock = /<!-- Header -->[\s\S]*?<!-- Introduction -->/;

const headerNew = `          <!-- Header -->
          <tr>
            <td style="background:#123d70; padding:26px 35px 24px 35px; text-align:center;">
              ${logoImg}
              <div style="font-size:22px; line-height:30px; font-weight:700; color:#ffffff; margin-top:6px;">
                MaxPro Infotech Limited
              </div>
              <div style="font-size:15px; line-height:23px; color:#dbeafe; margin-top:6px;">
                Integrated Business &amp; Sales Solutions
              </div>
            </td>
          </tr>

          <!-- Introduction -->`;

const targets = [
  "public/Email Templates/MaxPro_Business_Solutions_Email.html",
  "C:/Users/PC/Downloads/MaxPro_Business_Solutions_Email.html",
];

for (const file of targets) {
  const html = readFileSync(file, "utf8");
  if (!headerBlock.test(html)) {
    console.error("Header block not found in", file);
    process.exitCode = 1;
    continue;
  }
  writeFileSync(file, html.replace(headerBlock, headerNew), "utf8");
  console.log("Updated", basename(file));
}
