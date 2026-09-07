import * as Primitive from "@radix-ui/react-tooltip";
import { useLayoutEffect, useState, type ReactElement } from "react";

/** Portal into the app so hints inherit the active theme and interface font. */
export function Tooltip({
  label,
  children,
  disabled = false,
}: {
  label: string;
  children: ReactElement;
  disabled?: boolean;
}) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    setContainer(document.querySelector<HTMLElement>(".app") ?? document.body);
  }, []);
  return (
    <Primitive.Provider delayDuration={350} skipDelayDuration={100}>
      <Primitive.Root open={open && !disabled} onOpenChange={setOpen}>
        <Primitive.Trigger asChild>{children}</Primitive.Trigger>
        <Primitive.Portal container={container}>
          <Primitive.Content
            className="ui-tooltip"
            side="right"
            sideOffset={8}
            collisionPadding={10}
          >
            {label}
          </Primitive.Content>
        </Primitive.Portal>
      </Primitive.Root>
    </Primitive.Provider>
  );
}
