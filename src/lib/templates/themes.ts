/**
 * EMAIL THEMES
 * ============
 * A theme is the palette and type scale a skin renders with. Skins own layout;
 * themes own colour. Any of the 19 templates can render in any of these, which
 * is where the library's visual range comes from.
 *
 * Email clients cannot read CSS variables, so every value here is inlined into
 * the MJML at render time rather than referenced.
 *
 * Two rules kept all twelve usable for B2B outreach: the accent is the only
 * saturated colour in a theme, and body text never drops below roughly 7:1
 * against its own background.
 */

export type ThemeId =
  | "graphite"
  | "paper"
  | "ink"
  | "slate"
  | "oxford"
  | "bottle"
  | "teal"
  | "indigo"
  | "bordeaux"
  | "oxide"
  | "sandstone"
  | "carbon";

export interface EmailTheme {
  id: ThemeId;
  name: string;
  /** Shown in the theme picker. */
  description: string;
  /** Headings, wordmark and dark bands. */
  ink: string;
  /** The single saturated colour: buttons, kickers, rules. */
  accent: string;
  /** Accent variant legible on `ink` and `darkCanvas` backgrounds. */
  accentSoft: string;
  /** Text placed on top of `accent`. */
  onAccent: string;
  text: string;
  textMuted: string;
  rule: string;
  /** Outer page background, visible around the content card. */
  canvas: string;
  /** The content card itself. */
  surface: string;
  /** Subtle call-out and list panels. */
  panel: string;
  /** Canvas for the inverted `digest` skin. */
  darkCanvas: string;
  darkRule: string;
  darkText: string;
  darkMuted: string;
  fontSans: string;
  fontSerif: string;
  /** Buttons and panels. "0" gives the squared-off editorial themes their look. */
  radius: string;
}

const SANS = "Helvetica, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";
const GEOMETRIC = "'Trebuchet MS', 'Segoe UI', Helvetica, Arial, sans-serif";

export const emailThemes: EmailTheme[] = [
  {
    id: "graphite",
    name: "Graphite",
    description: "White page, black text, Maxpro teal. The default for outreach.",
    ink: "#111111",
    accent: "#00a8c0",
    accentSoft: "#5ec9d6",
    onAccent: "#ffffff",
    text: "#111111",
    textMuted: "#4a4a4a",
    rule: "#e6e6e6",
    canvas: "#ffffff",
    surface: "#ffffff",
    panel: "#f5f5f5",
    darkCanvas: "#0a0a0c",
    darkRule: "#232329",
    darkText: "#c8c8d0",
    darkMuted: "#7a7a86",
    fontSans: SANS,
    fontSerif: SERIF,
    radius: "6px",
  },
  {
    id: "paper",
    name: "Paper",
    description: "Pure white, hairline rules, black actions. The quietest option.",
    ink: "#000000",
    accent: "#111111",
    accentSoft: "#b8b8b8",
    onAccent: "#ffffff",
    text: "#1a1a1a",
    textMuted: "#707070",
    rule: "#e8e8e8",
    canvas: "#ffffff",
    surface: "#ffffff",
    panel: "#f6f6f6",
    darkCanvas: "#111111",
    darkRule: "#2b2b2b",
    darkText: "#d4d4d4",
    darkMuted: "#8a8a8a",
    fontSans: SANS,
    fontSerif: SERIF,
    radius: "0",
  },
  {
    id: "ink",
    name: "Ink",
    description: "Monochrome throughout. No colour at all, maximum formality.",
    ink: "#0d0d0d",
    accent: "#3d3d3d",
    accentSoft: "#a8a8a8",
    onAccent: "#ffffff",
    text: "#1f1f1f",
    textMuted: "#6b6b6b",
    rule: "#dedede",
    canvas: "#efefef",
    surface: "#ffffff",
    panel: "#f5f5f5",
    darkCanvas: "#0d0d0d",
    darkRule: "#282828",
    darkText: "#cccccc",
    darkMuted: "#7d7d7d",
    fontSans: SANS,
    fontSerif: SERIF,
    radius: "2px",
  },
  {
    id: "slate",
    name: "Slate",
    description: "Cool grey-blue with a steel accent. Reads as engineering.",
    ink: "#14181d",
    accent: "#3f6d8f",
    accentSoft: "#9dc0d8",
    onAccent: "#ffffff",
    text: "#1e242b",
    textMuted: "#66707b",
    rule: "#dfe4e9",
    canvas: "#eef1f4",
    surface: "#ffffff",
    panel: "#f4f7f9",
    darkCanvas: "#0e1216",
    darkRule: "#242c34",
    darkText: "#c4ced7",
    darkMuted: "#76828e",
    fontSans: SANS,
    fontSerif: SERIF,
    radius: "4px",
  },
  {
    id: "oxford",
    name: "Oxford",
    description: "Deep navy on warm white. Conservative and institutional.",
    ink: "#0f1c33",
    accent: "#1d3f76",
    accentSoft: "#9db4d8",
    onAccent: "#ffffff",
    text: "#1a2436",
    textMuted: "#5f6a7d",
    rule: "#dde2ea",
    canvas: "#f0f2f6",
    surface: "#ffffff",
    panel: "#f4f6fa",
    darkCanvas: "#0b1424",
    darkRule: "#1e2b42",
    darkText: "#c3cddd",
    darkMuted: "#74819a",
    fontSans: SANS,
    fontSerif: SERIF,
    radius: "3px",
  },
  {
    id: "bottle",
    name: "Bottle",
    description: "Deep green accent. Suits agri-input and finance conversations.",
    ink: "#101a15",
    accent: "#1f5d43",
    accentSoft: "#8fc4ac",
    onAccent: "#ffffff",
    text: "#1a231d",
    textMuted: "#5f6b64",
    rule: "#dde4e0",
    canvas: "#eff3f0",
    surface: "#ffffff",
    panel: "#f3f8f5",
    darkCanvas: "#0a1310",
    darkRule: "#1c2823",
    darkText: "#c2cfc8",
    darkMuted: "#748179",
    fontSans: SANS,
    fontSerif: SERIF,
    radius: "4px",
  },
  {
    id: "teal",
    name: "Teal",
    description: "Cool deep teal. Distinctive without reading as consumer tech.",
    ink: "#0c1a1c",
    accent: "#146b73",
    accentSoft: "#8ac9cf",
    onAccent: "#ffffff",
    text: "#182325",
    textMuted: "#5c6a6c",
    rule: "#dbe4e5",
    canvas: "#edf2f3",
    surface: "#ffffff",
    panel: "#f2f8f8",
    darkCanvas: "#081214",
    darkRule: "#1a2729",
    darkText: "#bfcfd1",
    darkMuted: "#6f8082",
    fontSans: SANS,
    fontSerif: SERIF,
    radius: "5px",
  },
  {
    id: "indigo",
    name: "Indigo",
    description: "Restrained violet-blue. The most contemporary of the set.",
    ink: "#121228",
    accent: "#4340a8",
    accentSoft: "#a9a6e6",
    onAccent: "#ffffff",
    text: "#1d1d2e",
    textMuted: "#666680",
    rule: "#e1e1ec",
    canvas: "#f1f1f6",
    surface: "#ffffff",
    panel: "#f6f6fc",
    darkCanvas: "#0b0b18",
    darkRule: "#22223a",
    darkText: "#c6c6d8",
    darkMuted: "#78788f",
    fontSans: GEOMETRIC,
    fontSerif: SERIF,
    radius: "8px",
  },
  {
    id: "bordeaux",
    name: "Bordeaux",
    description: "Deep maroon on cream. Built for the editorial templates.",
    ink: "#1c1113",
    accent: "#7a2233",
    accentSoft: "#d69aa6",
    onAccent: "#ffffff",
    text: "#241a1c",
    textMuted: "#6e6062",
    rule: "#e6dedd",
    canvas: "#f6f2ef",
    surface: "#fffdfb",
    panel: "#f8f3f2",
    darkCanvas: "#150d0f",
    darkRule: "#2b1e21",
    darkText: "#d2c6c6",
    darkMuted: "#8a7a7c",
    fontSans: SANS,
    fontSerif: SERIF,
    radius: "0",
  },
  {
    id: "oxide",
    name: "Oxide",
    description: "Burnt orange on warm grey. Industrial rather than playful.",
    ink: "#1b1512",
    accent: "#a1522a",
    accentSoft: "#e0ac8c",
    onAccent: "#ffffff",
    text: "#231c18",
    textMuted: "#6d6157",
    rule: "#e5e0da",
    canvas: "#f3f0ec",
    surface: "#ffffff",
    panel: "#f8f4f0",
    darkCanvas: "#130f0d",
    darkRule: "#282220",
    darkText: "#cec6bf",
    darkMuted: "#847a72",
    fontSans: SANS,
    fontSerif: SERIF,
    radius: "3px",
  },
  {
    id: "sandstone",
    name: "Sandstone",
    description: "Warm paper and brown-black. Reads as print, not software.",
    ink: "#1f1a13",
    accent: "#6b5433",
    accentSoft: "#cbb691",
    onAccent: "#ffffff",
    text: "#272119",
    textMuted: "#71675a",
    rule: "#e5dfd3",
    canvas: "#f5f1e8",
    surface: "#fffdf8",
    panel: "#f7f3ea",
    darkCanvas: "#15110c",
    darkRule: "#2a241b",
    darkText: "#d1c9bb",
    darkMuted: "#877d6e",
    fontSans: SANS,
    fontSerif: SERIF,
    radius: "0",
  },
  {
    id: "carbon",
    name: "Carbon",
    description: "Light Maxpro palette with teal accent and grey text.",
    ink: "#2e3438",
    accent: "#20a4b8",
    accentSoft: "#9da1a5",
    onAccent: "#ffffff",
    text: "#2e3438",
    textMuted: "#9da1a5",
    rule: "#e4e6e8",
    canvas: "#ffffff",
    surface: "#f7f8f9",
    panel: "#eef1f3",
    darkCanvas: "#2e3438",
    darkRule: "#cdd1d4",
    darkText: "#ffffff",
    darkMuted: "#9da1a5",
    fontSans: SANS,
    fontSerif: SERIF,
    radius: "6px",
  },
];

const byId = new Map(emailThemes.map((theme) => [theme.id, theme]));

export const DEFAULT_THEME_ID: ThemeId = "graphite";

export function getTheme(id: string | undefined): EmailTheme {
  return byId.get(id as ThemeId) ?? byId.get(DEFAULT_THEME_ID)!;
}

export const themeOptions = emailThemes.map((theme) => ({
  value: theme.id,
  label: theme.name,
  description: theme.description,
}));

/**
 * `carbon` inverts the light skins, so a signature or footer that assumes a
 * white card needs the dark treatment instead. Skins branch on this rather
 * than checking the theme id, so a future dark theme works without edits.
 */
export function isDarkTheme(theme: EmailTheme): boolean {
  return theme.surface === theme.darkCanvas || theme.canvas === theme.darkCanvas;
}
