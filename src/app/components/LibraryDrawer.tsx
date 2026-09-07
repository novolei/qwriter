import * as Dialog from "@radix-ui/react-dialog";
import { useLayoutEffect, useState, type ReactNode } from "react";
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
  useLayoutEffect(() => {
    setContainer(document.querySelector<HTMLElement>(".app") ?? document.body);
  }, []);
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
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              document
                .querySelector<HTMLButtonElement>(".library-toggle")
                ?.focus();
            }}
          >
            <Dialog.Title className="visually-hidden">
              {t("文稿库")}
            </Dialog.Title>
            {children}
          </Dialog.Content>
        </Dialog.Portal>
      )}
    </Dialog.Root>
  );
}
