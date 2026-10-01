import type { Component, Editor, Plugin, RichTextEditorAction } from "grapesjs";

const PLUGIN_ID = "maxreach-editor-tools";

const TEXT_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "span",
  "div",
  "a",
  "li",
  "td",
  "th",
  "label",
  "strong",
  "em",
]);

const EMAIL_STYLABLE = [
  "text-align",
  "color",
  "font-size",
  "font-weight",
  "font-family",
  "line-height",
  "letter-spacing",
  "text-decoration",
  "font-style",
  "vertical-align",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "background-color",
  "width",
  "height",
  "border",
  "border-radius",
  "left",
  "top",
  "z-index",
] as const;

const RTE_BUILTIN = ["bold", "italic", "underline", "strikethrough", "link", "wrap"] as const;

const ALIGN_RTE_ACTIONS: RichTextEditorAction[] = [
  {
    name: "align-left",
    icon: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 4h18v2H3V4m0 7h12v2H3v-2m0 7h18v2H3v-2Z"/></svg>',
    attributes: { title: "Align left" },
    result: (rte) => rte.exec("justifyLeft"),
  },
  {
    name: "align-center",
    icon: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 4h18v2H3V4m3 7h12v2H6v-2m-3 7h18v2H3v-2Z"/></svg>',
    attributes: { title: "Align center" },
    result: (rte) => rte.exec("justifyCenter"),
  },
  {
    name: "align-right",
    icon: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 4h18v2H3V4m6 7h12v2H9v-2m-6 7h18v2H3v-2Z"/></svg>',
    attributes: { title: "Align right" },
    result: (rte) => rte.exec("justifyRight"),
  },
];

export const editorRichTextActions = [...RTE_BUILTIN, ...ALIGN_RTE_ACTIONS];

function isLinkChild(component: Component): boolean {
  const parent = component.parent();
  return Boolean(
    parent && (parent.is("link") || String(parent.get("tagName")).toLowerCase() === "a"),
  );
}

function resolveAlignTarget(component: Component | null | undefined): Component | null {
  if (!component) return null;

  const type = component.get("type");
  if (type === "mx-free-text" || type === "text") return component;

  const tag = String(component.get("tagName") ?? "").toLowerCase();
  if (tag === "td" || tag === "th" || TEXT_TAGS.has(tag)) return component;

  let parent: Component | undefined = component.parent() ?? undefined;
  while (parent) {
    const parentType = parent.get("type");
    if (parentType === "mx-free-text") return parent;

    const parentTag = String(parent.get("tagName") ?? "").toLowerCase();
    if (parentTag === "td" || parentTag === "th") return parent;
    parent = parent.parent() ?? undefined;
  }

  return component;
}

function syncTableCellAlign(component: Component, value: "left" | "center" | "right" | "justify") {
  let parent: Component | undefined = component;
  while (parent) {
    const tag = String(parent.get("tagName") ?? "").toLowerCase();
    if (tag === "td" || tag === "th") {
      parent.addStyle({ "text-align": value });
      parent.addAttributes({ align: value === "justify" ? "left" : value });
      return;
    }
    parent = parent.parent() ?? undefined;
  }
}

function alignSelected(editor: Editor, value: "left" | "center" | "right" | "justify") {
  const target = resolveAlignTarget(editor.getSelected());
  if (!target) {
    editor.log("Select a text block first.", { level: "warning" });
    return;
  }

  target.addStyle({ "text-align": value });
  syncTableCellAlign(target, value);
  editor.trigger("update");
}

function unlockTextComponents(editor: Editor) {
  const walk = (component: Component) => {
    const tag = String(component.get("tagName") ?? "").toLowerCase();
    const type = component.get("type");

    if (type === "mx-free-layer") {
      component.components().forEach(walk);
      return;
    }

    if (
      type === "text" ||
      type === "mx-free-text" ||
      TEXT_TAGS.has(tag) ||
      component.getAttributes()["data-slot"]
    ) {
      if (isLinkChild(component)) {
        component.components().forEach(walk);
        return;
      }

      const stylable =
        type === "mx-free-text"
          ? [...EMAIL_STYLABLE]
          : ([...EMAIL_STYLABLE] as unknown as string[]);

      component.set({
        editable: type !== "mx-free-image",
        stylable,
        selectable: true,
        hoverable: true,
        highlightable: true,
      });
    }

    component.components().forEach(walk);
  };

  editor.getWrapper()?.components().forEach(walk);
}

function ensureTypographyAlignProperty(editor: Editor) {
  const sm = editor.StyleManager;
  const typography =
    sm.getSector("typography", { warn: false }) ??
    sm.getSector("Typography", { warn: false });

  if (!typography) return;

  if (!typography.getProperty("text-align")) {
    typography.addProperty(
      {
        name: "Alignment",
        property: "text-align",
        type: "radio",
        defaults: "left",
        list: [
          { id: "left", value: "left", name: "Left", className: "fa fa-align-left" },
          { id: "center", value: "center", name: "Center", className: "fa fa-align-center" },
          { id: "right", value: "right", name: "Right", className: "fa fa-align-right" },
          { id: "justify", value: "justify", name: "Justify", className: "fa fa-align-justify" },
        ],
      },
      {},
    );
  }
}

const WIRED_FLAG = "__mxEditorToolsWired";

function wireStyleManager(editor: Editor) {
  const flagged = editor as Editor & { [WIRED_FLAG]?: boolean };
  if (flagged[WIRED_FLAG]) return;
  flagged[WIRED_FLAG] = true;

  editor.on("style:property:update", (data) => {
    const propName = String(data.property.get("property") ?? "");
    if (propName !== "text-align") return;

    const selected = editor.getSelected();
    if (!selected) return;

    syncTableCellAlign(
      selected,
      String(data.value) as "left" | "center" | "right" | "justify",
    );
  });
}

function registerAlignCommands(editor: Editor) {
  editor.Commands.add("mx-align-left", {
    run(ed) {
      alignSelected(ed, "left");
    },
  });
  editor.Commands.add("mx-align-center", {
    run(ed) {
      alignSelected(ed, "center");
    },
  });
  editor.Commands.add("mx-align-right", {
    run(ed) {
      alignSelected(ed, "right");
    },
  });
}

function registerRichTextActions(editor: Editor) {
  for (const action of ALIGN_RTE_ACTIONS) {
    if (editor.RichTextEditor.get(action.name)) continue;
    editor.RichTextEditor.add(action.name, action);
  }
}

function refreshEditorTools(editor: Editor) {
  unlockTextComponents(editor);
  ensureTypographyAlignProperty(editor);
}

export const editorToolsPlugin: Plugin = (editor) => {
  registerAlignCommands(editor);

  editor.on("load", () => {
    refreshEditorTools(editor);
    registerRichTextActions(editor);
    wireStyleManager(editor);
  });

  editor.on("canvas:frame:load", () => {
    queueMicrotask(() => refreshEditorTools(editor));
  });

  editor.on("component:add", () => {
    queueMicrotask(() => unlockTextComponents(editor));
  });
};

export const editorToolsPluginId = PLUGIN_ID;

export function setupEditorTools(editor: Editor) {
  refreshEditorTools(editor);
  registerRichTextActions(editor);
  wireStyleManager(editor);
}
