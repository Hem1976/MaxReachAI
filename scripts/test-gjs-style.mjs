import grapesjs from "grapesjs";
import newsletter from "grapesjs-preset-newsletter";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

const container = document.createElement("div");
container.style.height = "800px";
document.body.appendChild(container);

const html = `<!doctype html><html><body><p style="text-align:left">Hello world</p></body></html>`;

const editor = grapesjs.init({
  container,
  height: "800px",
  storageManager: false,
  plugins: [newsletter],
  pluginsOpts: {
    "grapesjs-preset-newsletter": { showBlocksOnLoad: false },
  },
});

await new Promise((resolve) => editor.onReady(resolve));
editor.setComponents(html, { asDocument: true });

const p = editor.getWrapper()?.find("p")?.[0];
if (!p) {
  console.log("no p");
  process.exit(1);
}

editor.select(p);
console.log("before", p.getStyle(), p.getEl()?.getAttribute("style"));

const prop = editor.StyleManager.getProperties().find((pr) => pr.get("property") === "text-align");
console.log("prop found", Boolean(prop));
if (prop) {
  prop.upValue("center");
}

console.log("after style", p.getStyle());
console.log("after el", p.getEl()?.getAttribute("style"));
console.log("sectors", editor.StyleManager.getSectors().length);
console.log("rte default actions", editor.RichTextEditor.getConfig?.()?.actions ?? "n/a");

editor.destroy();
