import type { Doc } from "../../shared/types";
import { t } from "../../shared/i18n";

/** Seed content is localized once. Existing user manuscripts are never translated. */
export function createSeedDocs(): Doc[] {
  const updated = Date.now();
  return [
    {
      id: "welcome",
      title: t("seed.welcome.title"),
      markdown: t("seed.welcome.markdown"),
      updated,
    },
    {
      id: "ideas",
      title: t("seed.ideas.title"),
      markdown: t("seed.ideas.markdown"),
      updated,
    },
    {
      id: "story",
      title: t("seed.story.title"),
      markdown: t("seed.story.markdown"),
      updated,
    },
  ];
}
