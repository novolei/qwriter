import { test } from "node:test";
import assert from "node:assert/strict";
import { auditCatalogs, auditSource } from "../lib/i18n-audit.mjs";
const catalogs = {
  "zh-CN": { 保存: "保存", count_other: "{{count}}" },
  en: { 保存: "Save", count_other: "{{count}}" },
};
test("catches text, attribute and expression leaks without confusing translated keys", () => {
  const failures = auditSource(
    "view.tsx",
    'const a = <div title="提示">你好<span>{ok ? "完成" : "等待"}</span>{t("保存")}</div>',
    catalogs,
  );
  assert.equal(failures.length, 3);
  assert.deepEqual(
    auditSource(
      "view.tsx",
      'const a = <div title={t("保存")}>{t("count", {count: 2})}{document.title}</div>',
      catalogs,
    ),
    [],
  );
});
test("finds missing conditional translation keys and permits explicit language autonyms", () => {
  assert.equal(
    auditSource("view.tsx", 't(ok ? "保存" : "遗漏")', catalogs).length,
    2,
  );
  assert.deepEqual(
    auditSource("view.tsx", '<option lang="zh-CN">简体中文</option>', catalogs),
    [],
  );
});
test("rejects duplicate keys, empty values and mismatched interpolation", () => {
  const { failures } = auditCatalogs(
    '{"key":"{{count}}","empty":"","duplicate":"甲","duplicate":"乙"}',
    '{"key":"{{total}}","empty":"","duplicate":"Value"}',
  );
  assert.equal(failures.length, 3);
});
