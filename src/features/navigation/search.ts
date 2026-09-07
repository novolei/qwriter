import type { Doc } from "../../shared/types";

/** Local-only search; show an excerpt so writers can distinguish similar titles. */
export function searchDocuments(docs: Doc[], query: string, limit = 12) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return docs
    .map((doc) => {
      const title = doc.title.toLocaleLowerCase();
      const preview = doc.markdown
        .replace(
          /```qwriter-media\s*\n([\s\S]*?)\n```/g,
          (_, payload: string) => {
            try {
              const media: unknown = JSON.parse(payload);
              return media &&
                typeof media === "object" &&
                "title" in media &&
                typeof media.title === "string"
                ? media.title
                : "";
            } catch {
              return "";
            }
          },
        )
        .replace(/!?\[([^\]]*)\]\([^\n)]*\)/g, "$1");
      const text = preview.toLocaleLowerCase();
      if (!terms.every((term) => title.includes(term) || text.includes(term)))
        return null;
      const index = terms.length ? Math.max(0, text.indexOf(terms[0])) : 0;
      return {
        doc,
        score: terms.filter((term) => title.includes(term)).length,
        excerpt: preview
          .slice(Math.max(0, index - 30), index + 130)
          .replace(/[#*`>\n]/g, " ")
          .trim(),
      };
    })
    .filter((hit): hit is NonNullable<typeof hit> => hit !== null)
    .sort((a, b) => b.score - a.score || b.doc.updated - a.doc.updated)
    .slice(0, limit);
}
