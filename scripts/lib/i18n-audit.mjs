import ts from "typescript";

const han = /[\u3400-\u9fff]/;
const literal = (node) =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);

function staticValues(node, includeTemplates = true) {
  if (!node) return [];
  if (literal(node)) return [node.text];
  if (ts.isConditionalExpression(node))
    return [
      ...staticValues(node.whenTrue, includeTemplates),
      ...staticValues(node.whenFalse, includeTemplates),
    ];
  if (ts.isParenthesizedExpression(node))
    return staticValues(node.expression, includeTemplates);
  if (ts.isBinaryExpression(node))
    return [
      ...staticValues(node.left, includeTemplates),
      ...staticValues(node.right, includeTemplates),
    ];
  if (includeTemplates && ts.isTemplateExpression(node))
    return [
      node.head.text,
      ...node.templateSpans.map((span) => span.literal.text),
    ];
  return [];
}

function hasKey(catalog, key) {
  return Object.hasOwn(catalog, key) || Object.hasOwn(catalog, `${key}_other`);
}

/** Deliberately checks syntax, not arbitrary data flow or manuscript contents. */
export function auditSource(file, source, catalogs) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const failures = [];
  const fail = (node, message) => {
    const { line } = ast.getLineAndCharacterOfPosition(node.getStart());
    failures.push(`${file}:${line + 1}: ${message}`);
  };
  const translation = (node) =>
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "t";
  function visit(node) {
    if (translation(node)) {
      for (const key of staticValues(node.arguments[0], false)) {
        for (const [locale, catalog] of Object.entries(catalogs))
          if (!hasKey(catalog, key))
            fail(node, `Missing ${locale} translation: ${JSON.stringify(key)}`);
      }
    }
    if (ts.isJsxText(node) && han.test(node.text)) {
      // Language autonyms are intentionally displayed in their own language.
      const parent = node.parent;
      const autonym =
        ts.isJsxElement(parent) &&
        parent.openingElement.tagName.getText() === "option" &&
        parent.openingElement.attributes.properties.some(
          (attr) => ts.isJsxAttribute(attr) && attr.name.getText() === "lang",
        );
      if (!autonym) fail(node, "Untranslated Chinese JSX text; use t().");
    }
    if (
      ts.isJsxAttribute(node) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer) &&
      han.test(node.initializer.text)
    )
      fail(node, "Untranslated Chinese JSX attribute; use t().");
    if (
      ts.isJsxExpression(node) &&
      staticValues(node.expression).some((value) => han.test(value))
    )
      fail(node, "Untranslated Chinese JSX expression; use t().");
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return failures;
}

export function auditCatalogs(zhSource, enSource) {
  const failures = [];
  const catalogs = {};
  for (const [locale, source] of [
    ["zh-CN", zhSource],
    ["en", enSource],
  ]) {
    const ast = ts.parseJsonText(`${locale}.json`, source);
    const keys = new Set();
    const visit = (node) => {
      if (ts.isPropertyAssignment(node)) {
        const key = node.name.text;
        if (keys.has(key))
          failures.push(`${locale}: Duplicate translation key ${key}`);
        keys.add(key);
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
    catalogs[locale] = JSON.parse(source);
  }
  const variables = (value) =>
    [...value.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)]
      .map((match) => match[1])
      .sort()
      .join(",");
  for (const key of new Set([
    ...Object.keys(catalogs["zh-CN"]),
    ...Object.keys(catalogs.en),
  ])) {
    const zh = catalogs["zh-CN"][key],
      en = catalogs.en[key];
    if (
      typeof zh !== "string" ||
      typeof en !== "string" ||
      !zh.trim() ||
      !en.trim()
    ) {
      failures.push(`Missing or empty translation: ${key}`);
      continue;
    }
    if (han.test(en)) failures.push(`Chinese text in English catalog: ${key}`);
    if (variables(zh) !== variables(en))
      failures.push(`Interpolation mismatch: ${key}`);
  }
  return { failures, catalogs };
}
