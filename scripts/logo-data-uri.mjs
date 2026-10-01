import { readFileSync, writeFileSync } from "node:fs";

const b = readFileSync("public/email-assets/maxpro-logo-email-header.png");
const uri = `data:image/png;base64,${b.toString("base64")}`;
writeFileSync("scripts/logo-data-uri.txt", uri, "utf8");
console.log(uri.length);
