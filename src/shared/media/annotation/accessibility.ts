import { useEffect, type RefObject } from "react";

/** Shared adapter for screenshot and image annotation controls. */
export function useScreenshotControls(host: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = host.current;
    if (!root) return;
    const update = () => {
      root
        .querySelectorAll<HTMLElement>(".screenshots-button")
        .forEach((button) => {
          const disabled = button.classList.contains(
            "screenshots-button-disabled",
          );
          button.setAttribute("role", "button");
          button.setAttribute("aria-label", button.title);
          button.setAttribute("aria-disabled", String(disabled));
          button.tabIndex = disabled ? -1 : 0;
          if (
            button.querySelector(
              ".icon-rectangle, .icon-ellipse, .icon-arrow, .icon-brush, .icon-text, .icon-mosaic",
            )
          )
            button.setAttribute(
              "aria-pressed",
              String(button.classList.contains("screenshots-button-checked")),
            );
        });
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const button =
        event.target instanceof HTMLElement
          ? event.target.closest<HTMLElement>(".screenshots-button")
          : null;
      if (!button || button.getAttribute("aria-disabled") === "true") return;
      event.preventDefault();
      button.click();
    };
    const observer = new MutationObserver(update);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "title"],
    });
    root.addEventListener("keydown", keyboard);
    update();
    return () => {
      observer.disconnect();
      root.removeEventListener("keydown", keyboard);
    };
  }, [host]);
}
