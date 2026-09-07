import * as Dialog from "@radix-ui/react-dialog";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { PanelLeftClose } from "lucide-react";
import { t } from "../../shared/i18n/index";

export function LibraryDrawer({
  compact,
  open,
  onClose,
  children,
}: {
  compact: boolean;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setContainer(document.querySelector<HTMLElement>(".app") ?? document.body);
  }, []);
  useLayoutEffect(() => {
    if (compact && open) {
      returnFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    }
  }, [compact, open]);
  if (!compact) return children;
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      {container && (
        <Dialog.Portal container={container}>
          <Dialog.Overlay className="sidebar-scrim" />
          <Dialog.Content
            className="library-drawer"
            aria-describedby={undefined}
            onOpenAutoFocus={(event) => {
              const search = document.querySelector<HTMLInputElement>(
                ".library-drawer .search input",
              );
              if (search) {
                event.preventDefault();
                search.focus();
              }
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const target = returnFocus.current?.isConnected
                ? returnFocus.current
                : document.querySelector<HTMLButtonElement>(".library-toggle");
              target?.focus();
            }}
          >
            <Dialog.Title className="visually-hidden">
              {t("文稿库")}
            </Dialog.Title>
            {children}
            <Dialog.Close asChild>
              <button
                className="library-drawer-close"
                aria-label={t("收起文稿库")}
              >
                <PanelLeftClose size={18} strokeWidth={1.5} />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      )}
    </Dialog.Root>
  );
}
