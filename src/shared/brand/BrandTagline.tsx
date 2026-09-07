import { useEffect, useState } from "react";
import { t } from "../i18n/index";

const tips = [
  "每一个想法，都值得留下",
  "让文字，成为灵感的归处",
  "慢慢写，也是一种前行",
  "你的声音，值得被听见",
  "从一句话，开始一个世界",
  "留一点空白，让想法生长",
] as const;

export function BrandTagline({
  enabled,
  paused,
}: {
  enabled: boolean;
  paused: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const motion = () => setReducedMotion(media?.matches ?? false);
    const visibility = () => setVisible(!document.hidden);
    motion();
    media?.addEventListener("change", motion);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      media?.removeEventListener("change", motion);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (!enabled || paused || reducedMotion || !visible) return;
    const timer = window.setInterval(
      () => setIndex((old) => (old + 1) % tips.length),
      8000,
    );
    return () => window.clearInterval(timer);
  }, [enabled, paused, reducedMotion, visible]);
  const message = t(tips[index]);
  return (
    <small className="brand-tagline" title={message}>
      <span key={index} className="brand-tagline-text">
        {message}
      </span>
    </small>
  );
}
