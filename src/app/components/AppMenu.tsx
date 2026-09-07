import * as Menu from "@radix-ui/react-dropdown-menu";
import {
  Check,
  ChevronDown,
  Maximize2,
  Moon,
  Settings,
  SlidersHorizontal,
  Sun,
} from "lucide-react";
import { useRef, useState } from "react";
import { t } from "../../shared/i18n/index";
import { BrandIcon } from "../../shared/brand/BrandIcon";
import { BrandTagline } from "../../shared/brand/BrandTagline";
import { readLocal } from "../../shared/storage";
import { Tooltip } from "../../shared/ui/Tooltip";
export type AppMenuProps = {
  dark: boolean;
  focus: boolean;
  onTheme: () => void;
  onFocus: () => void;
  onAppearance: () => void;
  onSettings: () => void;
  compact?: boolean;
  rail?: boolean;
};
export function AppMenu({
  dark,
  focus,
  onTheme,
  onFocus,
  onAppearance,
  onSettings,
  compact = false,
  rail = false,
}: AppMenuProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [tipsEnabled, setTipsEnabled] = useState(() =>
    readLocal("qwriter.brand-tips", true),
  );
  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <Tooltip label={t("工作区菜单")} disabled={!rail || open}>
        <Menu.Trigger asChild>
          <button
            ref={ref}
            className={
              rail
                ? "app-menu-rail"
                : compact
                  ? "app-menu-compact"
                  : "brand-button"
            }
            aria-label={t("工作区菜单")}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          >
            {rail ? (
              <BrandIcon size={32} />
            ) : compact ? (
              <Settings size={16} />
            ) : (
              <>
                <BrandIcon size={42} />
                <span className="brand-wordmark">Qwriter</span>
                <ChevronDown size={13} />
                <BrandTagline
                  enabled={tipsEnabled}
                  paused={open || hovered || focused}
                />
              </>
            )}
          </button>
        </Menu.Trigger>
      </Tooltip>
      <Menu.Portal
        container={ref.current?.closest<HTMLElement>(".app") ?? undefined}
      >
        <Menu.Content
          className="ui-menu-content"
          sideOffset={7}
          side={rail ? "right" : "bottom"}
          align="start"
          collisionPadding={12}
          data-ui-overlay="menu"
        >
          <Menu.Label className="ui-menu-label">
            Qwriter <span>0.2 · PREVIEW</span>
          </Menu.Label>
          <Menu.Item className="ui-menu-item" onSelect={onAppearance}>
            <SlidersHorizontal size={15} />
            {t("阅读与排版")}
          </Menu.Item>
          <Menu.Item className="ui-menu-item" onSelect={onSettings}>
            <Settings size={15} />
            {t("模型与连接")}
          </Menu.Item>
          <Menu.Separator className="ui-menu-separator" />
          <Menu.CheckboxItem
            className="ui-menu-item"
            checked={dark}
            onCheckedChange={onTheme}
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />} {t("夜读模式")}
            <Menu.ItemIndicator>
              <Check size={13} />
            </Menu.ItemIndicator>
          </Menu.CheckboxItem>
          <Menu.CheckboxItem
            className="ui-menu-item"
            checked={focus}
            onCheckedChange={onFocus}
          >
            <Maximize2 size={15} />
            {t("专注模式")}
            <Menu.ItemIndicator>
              <Check size={13} />
            </Menu.ItemIndicator>
          </Menu.CheckboxItem>
          <Menu.Separator className="ui-menu-separator" />
          <Menu.CheckboxItem
            className="ui-menu-item"
            checked={tipsEnabled}
            onCheckedChange={(value) => {
              setTipsEnabled(value);
              try {
                localStorage.setItem(
                  "qwriter.brand-tips",
                  JSON.stringify(value),
                );
              } catch {
                /* The current session preference still applies. */
              }
            }}
          >
            {t("灵感短句轮播")}
            <Menu.ItemIndicator>
              <Check size={13} />
            </Menu.ItemIndicator>
          </Menu.CheckboxItem>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
