import type { Component, Editor, Plugin } from "grapesjs";

const PLUGIN_ID = "maxreach-free-layout";
const PLACEHOLDER_SRC =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const TEXT_STYLE = {
  position: "absolute",
  display: "block",
  margin: "0",
  padding: "8px 10px",
  "font-size": "15px",
  "line-height": "1.6",
  "font-family": "Arial, Helvetica, sans-serif",
  color: "#000000",
  background: "#ffffff",
  "box-sizing": "border-box",
  "pointer-events": "auto",
} as const;

function isDomElement(el: unknown): el is Element {
  return (
    typeof el === "object" &&
    el !== null &&
    "getAttribute" in el &&
    typeof (el as Element).getAttribute === "function"
  );
}

function parsePx(value: string | number | undefined) {
  const parsed = parseFloat(String(value ?? "0"));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function findFreeLayer(editor: Editor) {
  const matches = editor.getWrapper()?.find("#mx-free-layer") ?? [];
  return matches[0] ?? null;
}

export function ensureFreeLayer(editor: Editor) {
  const existing = findFreeLayer(editor);
  if (existing) return existing;

  const wrapper = editor.getWrapper();
  wrapper?.addStyle({ position: "relative", "min-height": "960px" });

  const appended = wrapper?.append({ type: "mx-free-layer" }, { at: -1 });
  return appended?.at(-1) ?? findFreeLayer(editor);
}

function nextPlacement(count: number) {
  return {
    left: `${48 + (count % 4) * 28}px`,
    top: `${120 + (count % 6) * 32}px`,
    zIndex: String(10 + count),
  };
}

export function placeFreeImage(editor: Editor, src: string) {
  if (!src.trim()) return null;

  const selected = editor.getSelected();
  if (
    selected &&
    (selected.is("image") || selected.get("type") === "mx-free-image")
  ) {
    selected.addAttributes({ src });
    selected.set("src", src);
    selected.set("dmode", "absolute");
    return selected;
  }

  const layer = ensureFreeLayer(editor);
  if (!layer) return null;

  const count = layer.components().length;
  const spot = nextPlacement(count);
  return layer.append({
    type: "mx-free-image",
    attributes: { src, alt: "" },
    style: {
      position: "absolute",
      left: spot.left,
      top: spot.top,
      width: "220px",
      height: "auto",
      display: "block",
      margin: "0",
      border: "0",
      "pointer-events": "auto",
      "z-index": spot.zIndex,
    },
  });
}

export function placeFreeText(editor: Editor, content = "New text") {
  const layer = ensureFreeLayer(editor);
  if (!layer) return null;

  const count = layer.components().length;
  const spot = nextPlacement(count);
  const component = layer.append({
    type: "mx-free-text",
    components: [{ type: "textnode", content }],
    style: {
      ...TEXT_STYLE,
      left: spot.left,
      top: spot.top,
      width: "240px",
      "z-index": spot.zIndex,
    },
  });

  const created = component?.at(-1);
  if (created) editor.select(created);
  return created ?? null;
}

function openImagePicker(editor: Editor, target?: Component | null) {
  const finish = (src: string) => {
    if (!src.trim()) return;
    if (target) {
      target.addAttributes({ src });
      target.set("src", src);
      target.set("dmode", "absolute");
      return;
    }
    placeFreeImage(editor, src);
  };

  editor.AssetManager.open({
    types: ["image"],
    target: target ?? undefined,
    select(asset, complete) {
      finish(asset.getSrc());
      if (complete) editor.AssetManager.close();
    },
  });
}

function openNativeImageUpload(editor: Editor, target?: Component | null) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml";
  input.style.display = "none";
  document.body.appendChild(input);

  input.addEventListener(
    "change",
    () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return;

      const formData = new FormData();
      formData.append("file", file);

      void fetch("/api/uploads?format=grapes", {
        method: "POST",
        body: formData,
      })
        .then((response) => response.json())
        .then((payload) => {
          const src = payload?.data?.[0]?.src;
          if (typeof src !== "string" || !src) {
            throw new Error(payload?.error ?? "Image upload failed.");
          }
          finishUpload(editor, src, target);
        })
        .catch((cause) => {
          editor.log(
            cause instanceof Error ? cause.message : "Image upload failed.",
            { level: "error" },
          );
        });
    },
    { once: true },
  );

  input.click();
}

function finishUpload(editor: Editor, src: string, target?: Component | null) {
  if (target) {
    target.addAttributes({ src });
    target.set("src", src);
    target.set("dmode", "absolute");
    return;
  }
  placeFreeImage(editor, src);
}

function componentFromTarget(editor: Editor, target: EventTarget | null): Component | null {
  if (!(target instanceof Element)) return null;
  let node: Element | null = target;
  while (node) {
    const view = (node as Element & { __gjsv?: { model: Component } }).__gjsv;
    if (view?.model) return view.model;
    node = node.parentElement;
  }
  return null;
}

function isImageComponent(component: Component): boolean {
  const tag = String(component.get("tagName") ?? "").toLowerCase();
  return component.is("image") || tag === "img" || component.get("type") === "mx-free-image";
}

/** Turn template logos and images into Canva-style free layers at their current positions. */
export function promoteImagesToFreeLayer(editor: Editor) {
  const wrapper = editor.getWrapper();
  if (!wrapper) return;

  const images = wrapper.find("img") ?? [];
  for (const component of images) {
    if (component.getAttributes()["data-mx-free"] === "1") continue;
    const src = String(component.getAttributes().src || component.get("src") || "");
    if (!src || src === PLACEHOLDER_SRC) continue;
    convertToFree(editor, component);
  }
}

function lockFlowLayoutComponents(editor: Editor) {
  const walk = (component: Component) => {
    const type = component.get("type");
    const tag = String(component.get("tagName") ?? "").toLowerCase();

    if (type === "mx-free-layer" || type === "mx-free-image" || type === "mx-free-text") {
      component.components().forEach(walk);
      return;
    }

    if (isImageComponent(component)) {
      component.set({
        draggable: false,
        droppable: false,
        stoppable: true,
        highlightable: true,
        selectable: true,
      });
    } else if (type !== "mx-free-layer") {
      component.set({
        draggable: false,
        droppable: tag !== "td" && tag !== "th",
      });
    }

    if (tag === "table" || tag === "tbody" || tag === "tr" || tag === "td" || tag === "th") {
      component.set({ draggable: false, droppable: false, copyable: false });
    }

    component.components().forEach(walk);
  };
  editor.getWrapper()?.components().forEach(walk);
}

function isGrapesResizeHandle(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(".gjs-resizer-h, .gjs-resizer-hc, .gjs-resizer-h-cl, .gjs-resizer-h-cr"),
  );
}

function blockFlowComponentDrag(editor: Editor) {
  const shouldBlockDrag = (component: Component | null | undefined) => {
    if (!component) return false;
    if (component.getAttributes()["data-mx-free"] === "1") return true;
    if (isImageComponent(component)) return true;

    let parent: Component | undefined = component;
    while (parent) {
      const type = parent.get("type");
      if (type === "mx-free-layer") return false;
      const tag = String(parent.get("tagName") ?? "").toLowerCase();
      if (tag === "td" || tag === "th" || tag === "tr" || tag === "table" || tag === "tbody") {
        return true;
      }
      parent = parent.parent();
    }
    return false;
  };

  editor.on("run:core:component-drag:before", () => {
    if (shouldBlockDrag(editor.getSelected())) return false;
  });

  editor.on("sorter:drag:start", () => {
    if (shouldBlockDrag(editor.getSelected())) return false;
  });
}

function modelFromFreeTarget(target: EventTarget | null, editor: Editor) {
  if (!(target instanceof Element)) return null;
  const el = target.closest('[data-mx-free="1"]');
  if (!el) return null;

  const view = (el as Element & { __gjsv?: { model: Component } }).__gjsv;
  if (view?.model) return view.model;

  const wrapper = editor.getWrapper();
  const found = wrapper?.find(`[data-mx-free="1"]`) ?? [];
  for (const component of found) {
    if (component.getEl() === el) return component;
  }
  return null;
}

function isEditingTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("[contenteditable='true'], .gjs-rte-active"));
}

function ensureCanvasBody(editor: Editor) {
  const doc = editor.Canvas.getDocument();
  if (!doc?.body) return;
  doc.body.style.position = "relative";
  doc.body.style.minHeight = "960px";
  doc.body.style.backgroundColor = "#ffffff";
  doc.body.style.color = "#000000";
  doc.body.style.fontFamily = "Arial, Helvetica, sans-serif";

  if (doc.getElementById("mx-editor-surface-style")) return;
  const style = doc.createElement("style");
  style.id = "mx-editor-surface-style";
  style.textContent = `
    html, body {
      background: #ffffff !important;
      color: #000000 !important;
    }
    [data-mx-free="1"][data-mx-block="text"] {
      color: #000000 !important;
      background: #ffffff !important;
    }
    img[data-mx-free="1"],
    [data-mx-free="1"].gjs-selected {
      outline: 2px solid #20a4b8 !important;
      outline-offset: 2px;
      cursor: move;
    }
    img[data-mx-free="1"] {
      touch-action: none;
    }
  `;
  doc.head.appendChild(style);
}

function convertToFree(editor: Editor, component: Component) {
  if (component.getAttributes()["data-mx-free"] === "1") return component;

  const el = component.getEl();
  const doc = editor.Canvas.getDocument();
  if (!el || !doc?.body) return null;

  const bodyRect = doc.body.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  const scrollTop = doc.documentElement.scrollTop || doc.body.scrollTop || 0;
  const scrollLeft = doc.documentElement.scrollLeft || doc.body.scrollLeft || 0;
  const left = Math.max(0, Math.round(rect.left - bodyRect.left + scrollLeft));
  const top = Math.max(0, Math.round(rect.top - bodyRect.top + scrollTop));
  const width = Math.max(80, Math.round(rect.width));

  const layer = ensureFreeLayer(editor);
  if (!layer) return null;

  const isImage = component.is("image") || component.get("type") === "mx-free-image";
  let created: Component | null = null;

  if (isImage) {
    const src = String(component.getAttributes().src || component.get("src") || "");
    created =
      layer.append({
        type: "mx-free-image",
        attributes: { src, alt: component.getAttributes().alt ?? "" },
        style: {
          position: "absolute",
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          height: "auto",
          display: "block",
          margin: "0",
          border: "0",
          "pointer-events": "auto",
          "z-index": "20",
        },
      })?.at(-1) ?? null;
  } else {
    const content = component.getInnerHTML?.() || el.innerHTML || el.textContent || "Text";
    created =
      layer.append({
        type: "mx-free-text",
        components: content,
        style: {
          ...TEXT_STYLE,
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          "z-index": "20",
        },
      })?.at(-1) ?? null;
  }

  component.remove();
  if (created) editor.select(created);
  return created;
}

function setupFreeDrag(editor: Editor) {
  const attach = () => {
    const doc = editor.Canvas.getDocument();
    const win = editor.Canvas.getWindow();
    if (!doc || !win) return;

    ensureCanvasBody(editor);

    const flaggedDoc = doc as Document & { __mxFreeDrag?: boolean };
    if (flaggedDoc.__mxFreeDrag) return;
    flaggedDoc.__mxFreeDrag = true;

    let dragState: {
      model: Component;
      startX: number;
      startY: number;
      originLeft: number;
      originTop: number;
      active: boolean;
    } | null = null;

    let pendingImage: {
      component: Component;
      startX: number;
      startY: number;
    } | null = null;

    const stopDrag = () => {
      dragState = null;
      pendingImage = null;
    };

    doc.addEventListener(
      "mousedown",
      (event) => {
        if (event.button !== 0 || isEditingTarget(event.target)) return;
        if (isGrapesResizeHandle(event.target)) return;

        const freeModel = modelFromFreeTarget(event.target, editor);
        if (freeModel) {
          const style = freeModel.getStyle();
          dragState = {
            model: freeModel,
            startX: event.clientX,
            startY: event.clientY,
            originLeft: parsePx(String(style.left ?? "0")),
            originTop: parsePx(String(style.top ?? "0")),
            active: false,
          };
          freeModel.set("dmode", "absolute");
          return;
        }

        const component = componentFromTarget(editor, event.target);
        if (component && isImageComponent(component)) {
          pendingImage = {
            component,
            startX: event.clientX,
            startY: event.clientY,
          };
        }
      },
      false,
    );

    doc.addEventListener(
      "mousemove",
      (event) => {
        if (pendingImage) {
          const dx = event.clientX - pendingImage.startX;
          const dy = event.clientY - pendingImage.startY;
          if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;

          const converted = convertToFree(editor, pendingImage.component);
          pendingImage = null;
          if (!converted) return;

          const style = converted.getStyle();
          dragState = {
            model: converted,
            startX: event.clientX,
            startY: event.clientY,
            originLeft: parsePx(String(style.left ?? "0")),
            originTop: parsePx(String(style.top ?? "0")),
            active: true,
          };
          converted.set("dmode", "absolute");
          editor.select(converted);
          event.preventDefault();
          return;
        }

        if (!dragState) return;
        const dx = event.clientX - dragState.startX;
        const dy = event.clientY - dragState.startY;
        if (!dragState.active) {
          if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
          dragState.active = true;
          editor.select(dragState.model);
        }
        dragState.model.addStyle({
          left: `${Math.max(0, Math.round(dragState.originLeft + dx))}px`,
          top: `${Math.max(0, Math.round(dragState.originTop + dy))}px`,
        });
        event.preventDefault();
      },
      true,
    );

    doc.addEventListener("mouseup", stopDrag, true);
    win.addEventListener("mouseup", stopDrag, true);

    doc.addEventListener(
      "dragstart",
      (event) => {
        const target = event.target;
        if (modelFromFreeTarget(target, editor)) {
          event.preventDefault();
          return;
        }
        if (target instanceof HTMLImageElement) {
          event.preventDefault();
        }
      },
      true,
    );
  };

  editor.on("canvas:frame:load", attach);
  editor.on("load", attach);
  attach();
}

function registerCommands(editor: Editor) {
  editor.Commands.add("mx-add-image", {
    run(ed) {
      openNativeImageUpload(ed);
    },
  });

  editor.Commands.add("mx-add-text", {
    run(ed) {
      placeFreeText(ed);
    },
  });

  editor.Commands.add("mx-delete-selected", {
    run(ed) {
      const selected = ed.getSelected();
      if (selected?.getAttributes()["data-mx-free"] === "1") {
        selected.remove();
      }
    },
  });

  editor.Commands.add("mx-make-free", {
    run(ed) {
      const selected = ed.getSelected();
      if (!selected) return;
      convertToFree(ed, selected);
    },
  });

  editor.Commands.add("mx-layer-forward", {
    run(ed) {
      const selected = ed.getSelected();
      if (!selected?.getAttributes()["data-mx-free"]) return;
      const current = parsePx(String(selected.getStyle()["z-index"] ?? "10"));
      selected.addStyle({ "z-index": String(current + 1) });
    },
  });

  editor.Commands.add("mx-layer-backward", {
    run(ed) {
      const selected = ed.getSelected();
      if (!selected?.getAttributes()["data-mx-free"]) return;
      const current = parsePx(String(selected.getStyle()["z-index"] ?? "10"));
      selected.addStyle({ "z-index": String(Math.max(1, current - 1)) });
    },
  });
}

function registerToolbarButtons(editor: Editor) {
  const panelId = editor.Panels.getPanel("commands") ? "commands" : "options";
  if (!editor.Panels.getPanel(panelId)) return;

  const buttons = [
    {
      id: "mx-add-text-btn",
      title: "Add text box",
      command: "mx-add-text",
      label:
        '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M5 4v3h5.5v12h3V7H19V4z"/></svg>',
    },
    {
      id: "mx-add-image-btn",
      title: "Add image",
      command: "mx-add-image",
      label:
        '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2M8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>',
    },
    {
      id: "mx-make-free-btn",
      title: "Free placement (move anywhere)",
      command: "mx-make-free",
      label:
        '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5zM5 16l.8 2.4L8 19l-2.2.6L5 22l-.8-2.4L2 19l2.2-.6zM19 16l.8 2.4L22 19l-2.2.6L19 22l-.8-2.4L16 19l2.2-.6z"/></svg>',
    },
    {
      id: "mx-delete-btn",
      title: "Delete selected",
      command: "mx-delete-selected",
      label:
        '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12M19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
    },
  ];

  for (const button of buttons) {
    if (editor.Panels.getButton(panelId, button.id)) continue;
    editor.Panels.addButton(panelId, {
      id: button.id,
      className: "mx-gjs-toolbar-btn",
      command: button.command,
      attributes: { title: button.title },
      label: button.label,
    });
  }
}

export const freeLayoutPlugin: Plugin = (editor) => {
  const dc = editor.DomComponents;
  const bm = editor.BlockManager;

  registerCommands(editor);

  dc.addType("mx-free-layer", {
    isComponent: (el) => {
      if (!isDomElement(el)) return false;
      return el.id === "mx-free-layer" ||
        el.getAttribute("data-mx-free-layer") === "1"
        ? { type: "mx-free-layer" }
        : false;
    },
    model: {
      defaults: {
        tagName: "div",
        name: "Free layer",
        attributes: { id: "mx-free-layer", "data-mx-free-layer": "1" },
        draggable: false,
        droppable: ["mx-free-image", "mx-free-text", "image"],
        selectable: false,
        hoverable: false,
        layerable: false,
        copyable: false,
        removable: false,
        style: {
          position: "absolute",
          left: "0",
          top: "0",
          width: "100%",
          height: "100%",
          "min-height": "100%",
          "pointer-events": "none",
          "z-index": "5",
        },
      },
    },
  });

  dc.addType("mx-free-image", {
    extend: "image",
    isComponent: (el) => {
      if (!isDomElement(el) || el.tagName !== "IMG") return false;
      return el.getAttribute("data-mx-free") === "1"
        ? { type: "mx-free-image" }
        : false;
    },
    model: {
      defaults: {
        type: "mx-free-image",
        name: "Image",
        attributes: {
          "data-mx-free": "1",
          alt: "",
        },
        draggable: false,
        droppable: false,
        copyable: true,
        removable: true,
        resizable: {
          ratioDefault: true,
          tl: 0,
          tc: 0,
          tr: 0,
          cl: 0,
          cr: 1,
          bl: 0,
          bc: 0,
          br: 1,
        },
        style: {
          position: "absolute",
          display: "block",
          margin: "0",
          border: "0",
          "pointer-events": "auto",
        },
      },
      init() {
        this.set("dmode", "absolute");
      },
    },
  });

  dc.addType("mx-free-text", {
    isComponent: (el) => {
      if (!isDomElement(el)) return false;
      if (el.tagName === "IMG") return false;
      return el.getAttribute("data-mx-free") === "1"
        ? { type: "mx-free-text" }
        : false;
    },
    model: {
      defaults: {
        tagName: "div",
        type: "mx-free-text",
        name: "Text box",
        attributes: {
          "data-mx-free": "1",
          "data-mx-block": "text",
        },
        draggable: false,
        droppable: false,
        editable: true,
        highlightable: true,
        copyable: true,
        removable: true,
        stylable: [
          "text-align",
          "color",
          "font-size",
          "font-weight",
          "line-height",
          "padding",
          "background-color",
          "width",
          "left",
          "top",
          "z-index",
        ],
        resizable: {
          tl: 0,
          tc: 0,
          tr: 0,
          cl: 0,
          cr: 1,
          bl: 0,
          bc: 0,
          br: 0,
        },
        style: TEXT_STYLE,
      },
      init() {
        this.set("dmode", "absolute");
      },
    },
  });

  bm.add("mx-add-text", {
    id: "mx-add-text",
    label: "Add text",
    category: "Extra",
    media:
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M5 4v3h5.5v12h3V7H19V4z"/></svg>',
    onClick(_block, ed) {
      ed.runCommand("mx-add-text");
    },
  });

  bm.add("mx-add-image", {
    id: "mx-add-image",
    label: "Add image",
    category: "Extra",
    media:
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2M8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>',
    onClick(_block, ed) {
      ed.runCommand("mx-add-image");
    },
  });

  editor.on("component:add", (component) => {
    const type = component.get("type");
    if (type !== "mx-free-image" && type !== "mx-free-text") return;

    const layer = ensureFreeLayer(editor);
    if (layer && component.parent() !== layer) {
      component.move(layer, { at: layer.components().length });
    }

    if (type === "mx-free-image") {
      const src = component.getAttributes().src || component.get("src") || "";
      if (!src || src === PLACEHOLDER_SRC) {
        queueMicrotask(() => {
          editor.select(component);
          openImagePicker(editor, component);
        });
        return;
      }
    }

    component.set("dmode", "absolute");
  });

  editor.on("component:selected", (component) => {
    if (component.getAttributes()["data-mx-free"] === "1") {
      component.set("dmode", "absolute");
    }
  });

  blockFlowComponentDrag(editor);

  editor.on("asset:upload:response", (response) => {
    const src = response?.data?.[0]?.src;
    if (typeof src !== "string" || !src) return;

    const selected = editor.getSelected();
    if (
      selected &&
      (selected.is("image") || selected.get("type") === "mx-free-image")
    ) {
      selected.addAttributes({ src });
      selected.set("src", src);
      selected.set("dmode", "absolute");
      return;
    }

    if (!editor.AssetManager.isOpen()) {
      placeFreeImage(editor, src);
    }
  });
};

export const freeLayoutPluginId = PLUGIN_ID;

export function setupFreeLayout(editor: Editor) {
  ensureFreeLayer(editor);
  registerToolbarButtons(editor);
  setupFreeDrag(editor);

  let imagesPromoted = false;

  const lockLayout = () => {
    lockFlowLayoutComponents(editor);
  };

  const promoteWhenReady = () => {
    if (imagesPromoted) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (imagesPromoted) return;
        promoteImagesToFreeLayer(editor);
        lockFlowLayoutComponents(editor);
        imagesPromoted = true;
        editor.refresh();
      });
    });
  };

  editor.on("canvas:frame:load", () => {
    lockLayout();
    promoteWhenReady();
  });
  editor.on("load", () => {
    lockLayout();
    promoteWhenReady();
  });
  lockLayout();
  promoteWhenReady();
}
