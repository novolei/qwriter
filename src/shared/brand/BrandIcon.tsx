import { Feather } from "lucide-react";
import tokens from "./tokens.json";

/** Qwriter's official mark, using the same Feather as the original workspace. */
export function BrandIcon({ size = 38 }: { size?: number }) {
  return (
    <span
      className="brand-icon"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: size * tokens.radiusRatio,
      }}
    >
      <Feather size={size * tokens.glyphRatio} strokeWidth={2} />
    </span>
  );
}
