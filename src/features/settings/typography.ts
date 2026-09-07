export const fontChoices = [
  {
    id: "noto-sans",
    name: "Noto Sans SC · 现代黑体（无衬线）",
    family: '"Noto Sans SC Variable", sans-serif',
    kind: "内置 · 无衬线",
  },
  {
    id: "noto-serif",
    name: "Noto Serif SC · 书卷宋体（衬线）",
    family: '"Noto Serif SC Variable", serif',
    kind: "内置 · 衬线",
  },
  {
    id: "system-sans",
    name: "系统默认 · 无衬线",
    family:
      'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans SC Variable", sans-serif',
    kind: "系统 · 无衬线",
  },
  {
    id: "system-serif",
    name: "系统默认 · 衬线",
    family: '"Songti SC", "SimSun", "Noto Serif SC Variable", serif',
    kind: "系统 · 衬线",
  },
] as const;
export type FontId = (typeof fontChoices)[number]["id"];
export const latinFontChoices = [
  {
    id: "inter",
    name: "Inter",
    kind: "无衬线",
    family: '"Inter Variable"',
  },
  {
    id: "manrope",
    name: "Manrope",
    kind: "无衬线",
    family: '"Manrope Variable"',
  },
  {
    id: "source-sans",
    name: "Source Sans 3",
    kind: "无衬线",
    family: '"Source Sans 3 Variable"',
  },
  {
    id: "lora",
    name: "Lora",
    kind: "衬线",
    family: '"Lora Variable"',
  },
  {
    id: "source-serif",
    name: "Source Serif 4",
    kind: "衬线",
    family: '"Source Serif 4 Variable"',
  },
] as const;
export type LatinFontId = (typeof latinFontChoices)[number]["id"];
export type Typography = {
  fontSize: number;
  lineHeight: number;
  width: number;
  uiFont: FontId;
  documentFont: FontId;
  uiLatin: LatinFontId;
  documentLatin: LatinFontId;
};
export function fontFamily(id: FontId, latin: LatinFontId = "inter") {
  return `${latinFontChoices.find((f) => f.id === latin)?.family ?? latinFontChoices[0].family}, ${fontChoices.find((f) => f.id === id)?.family ?? fontChoices[0].family}`;
}
export function normalizeTypography(input: unknown): Typography {
  const value = (
    input && typeof input === "object" ? input : {}
  ) as Partial<Typography>;
  const number = (n: unknown, fallback: number, min: number, max: number) =>
    typeof n === "number" && Number.isFinite(n)
      ? Math.min(max, Math.max(min, n))
      : fallback;
  const font = (id: unknown, fallback: FontId): FontId =>
    fontChoices.some((f) => f.id === id) ? (id as FontId) : fallback;
  return {
    fontSize: number(value.fontSize, 17, 14, 24),
    lineHeight: number(value.lineHeight, 2, 1.6, 2.6),
    width: number(value.width, 760, 640, 960),
    uiFont: font(value.uiFont, "noto-sans"),
    documentFont: font(value.documentFont, "noto-serif"),
    uiLatin: latinFontChoices.some((f) => f.id === value.uiLatin)
      ? value.uiLatin!
      : "inter",
    documentLatin: latinFontChoices.some((f) => f.id === value.documentLatin)
      ? value.documentLatin!
      : "source-serif",
  };
}
