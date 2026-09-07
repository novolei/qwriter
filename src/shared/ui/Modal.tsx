import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { t } from "../i18n/index";
import { useDialogDrag } from "./useDialogDrag";

export function Modal({
  title,
  eyebrow = "QWRITER",
  onClose,
  children,
  wide = false,
  settings = false,
  className = "",
  draggable = false,
  dismissible = true,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  settings?: boolean;
  className?: string;
  draggable?: boolean;
  dismissible?: boolean;
}) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const drag = useDialogDrag(content, draggable);
  useLayoutEffect(() => {
    returnFocus.current =
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body
        ? document.activeElement
        : null;
    setContainer(document.querySelector<HTMLElement>(".app") ?? document.body);
  }, []);
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && dismissible) onClose();
      }}
    >
      {container && (
        <Dialog.Portal container={container}>
          <Dialog.Overlay className="modal-backdrop">
            <Dialog.Content
              ref={content}
              style={drag.style}
              onEscapeKeyDown={(event) => {
                if (!dismissible) event.preventDefault();
              }}
              onInteractOutside={(event) => {
                if (!dismissible || draggable) event.preventDefault();
              }}
              className={`modal ${wide ? "wide-modal" : ""} ${settings ? "settings-modal" : ""} ${className}`}
              aria-describedby={undefined}
              onOpenAutoFocus={(event) => {
                const target =
                  content.current?.querySelector<HTMLElement>(
                    "[data-autofocus]",
                  );
                if (target) {
                  event.preventDefault();
                  target.focus();
                }
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                const next = Array.from(
                  document.querySelectorAll<HTMLElement>(".modal"),
                ).find((node) => node !== content.current);
                if (next) {
                  (
                    next.querySelector<HTMLElement>("[data-autofocus]") ??
                    next.querySelector<HTMLElement>("button, input, textarea")
                  )?.focus();
                  return;
                }
                if (returnFocus.current?.isConnected)
                  returnFocus.current.focus();
                else
                  document
                    .querySelector<HTMLButtonElement>(
                      `button[aria-label="${t("工作区菜单")}"]`,
                    )
                    ?.focus();
              }}
            >
              <div
                className={`modal-heading ${draggable ? "draggable-heading" : ""}`}
                {...drag.handle}
                tabIndex={draggable ? 0 : undefined}
                aria-label={
                  draggable ? t("拖动窗口；方向键移动，Home 居中") : undefined
                }
              >
                <div>
                  <span className="eyebrow">{eyebrow}</span>
                  <Dialog.Title asChild>
                    <h2>{title}</h2>
                  </Dialog.Title>
                </div>
                <Dialog.Close asChild>
                  <button title={t("关闭弹窗")} disabled={!dismissible}>
                    <X size={20} />
                  </button>
                </Dialog.Close>
              </div>
              <div className="modal-body" tabIndex={0}>
                {children}
              </div>
            </Dialog.Content>
          </Dialog.Overlay>
        </Dialog.Portal>
      )}
    </Dialog.Root>
  );
}
