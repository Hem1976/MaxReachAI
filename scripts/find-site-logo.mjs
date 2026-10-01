const html = await fetch("https://maxproinfotech.com/").then((r) => r.text());
const urls = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)].map((m) => m[1]);
const logos = urls.filter((u) => /logo|brand|maxpro/i.test(u));
console.log(logos.slice(0, 20));
