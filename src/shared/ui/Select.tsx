import * as Primitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import {
  Children,
  isValidElement,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Props = {
  value: string | number;
  onValueChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
  leadingIcon?: ReactNode;
  "aria-label"?: string;
  title?: string;
};
/** Shared keyboard-accessible select. Option values remain stable across locales. */
export function Select({
  value,
  onValueChange,
  children,
  disabled,
  className = "",
  leadingIcon,
  ...label
}: Props) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const options = Children.toArray(children).filter(
    isValidElement<{
      value?: string | number;
      children?: ReactNode;
      disabled?: boolean;
    }>,
  );
  return (
    <Primitive.Root
      value={String(value)}
      onValueChange={onValueChange}
      disabled={disabled}
      open={open}
      onOpenChange={setOpen}
    >
      <Primitive.Trigger
        ref={trigger}
        {...label}
        className={`ui-select-trigger ${className}`}
      >
        {leadingIcon && (
          <span className="ui-select-leading" aria-hidden="true">
            {leadingIcon}
          </span>
        )}
        <span className="ui-select-value">
          <Primitive.Value />
        </span>
        <Primitive.Icon className="ui-select-chevron">
          <ChevronDown size={13} />
        </Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal
        container={trigger.current?.closest<HTMLElement>(".app") ?? undefined}
      >
        <Primitive.Content
          className="ui-select-content"
          position="popper"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          data-ui-overlay="select"
        >
          <Primitive.ScrollUpButton className="ui-select-scroll">
            <ChevronUp size={13} />
          </Primitive.ScrollUpButton>
          <Primitive.Viewport className="ui-select-viewport">
            {options.map((option) => (
              <Primitive.Item
                key={String(option.props.value)}
                value={String(option.props.value)}
                disabled={option.props.disabled}
                className="ui-select-item"
              >
                <Primitive.ItemText>{option.props.children}</Primitive.ItemText>
                <Primitive.ItemIndicator className="ui-select-check">
                  <Check size={13} />
                </Primitive.ItemIndicator>
              </Primitive.Item>
            ))}
          </Primitive.Viewport>
          <Primitive.ScrollDownButton className="ui-select-scroll">
            <ChevronDown size={13} />
          </Primitive.ScrollDownButton>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
