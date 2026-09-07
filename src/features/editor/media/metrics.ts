import { mediaContent } from "./MediaNode";

export function documentCharacters(markdown: string) {
  const visible = markdown
    .replace(
      /^```qwriter-media\r?\n([^\n]*)\r?\n```/gm,
      (fence, json: string) => {
        try {
          const media = mediaContent(JSON.parse(json));
          return media ? `${media.title} ${media.description}` : fence;
        } catch {
          return fence;
        }
      },
    )
    .replace(
      /!\[([^\]]*)\]\(qwriter-asset:\/\/[a-f0-9]{64}\.[a-z0-9]+\)/gi,
      "$1",
    );
  return visible.replace(/[#*`>\-\s]/g, "").length;
}
