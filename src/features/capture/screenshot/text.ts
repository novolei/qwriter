export function readableOcr(text: string) {
  // Tesseract's Chinese model separates glyphs with spaces. Preserve Latin words
  // and line breaks while removing only spaces between Chinese glyphs.
  return text
    .replace(/([\p{Script=Han}])[ \t]+(?=[\p{Script=Han}])/gu, "$1")
    .trim();
}
