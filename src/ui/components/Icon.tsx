import { type ComponentChildren, createContext, type JSX } from "preact";
import { useContext } from "preact/hooks";
import type { IconName } from "../../shared/design/icon-names.ts";

const IconSpriteContext = createContext("/src/shared/design/icons.svg");

/** Props accepted by {@link Icon}. */
export interface IconProps {
  readonly name: IconName;
  readonly size?: number;
  readonly color?: string;
}

/** Props accepted by {@link IconSpriteProvider}. */
export interface IconSpriteProviderProps {
  readonly url: string;
  readonly children?: ComponentChildren;
}

/**
 * Supplies the browser-resolved external sprite URL used by descendant icons.
 *
 * W3.2 passes `browser.runtime.getURL(...)` here for injected UI; extension and gallery pages may
 * use the root-relative default.
 *
 * @param props Resolved sprite URL and descendant component tree.
 * @returns The sprite context provider.
 */
export function IconSpriteProvider(
  { url, children }: IconSpriteProviderProps,
): JSX.Element {
  return <IconSpriteContext.Provider value={url}>{children}</IconSpriteContext.Provider>;
}

/**
 * Renders one typed symbol from the vendored Lucide SVG sprite.
 *
 * @param props Typed icon name, rendered size, and optional token-derived color.
 * @returns The decorative SVG icon.
 */
export function Icon(
  { name, size = 18, color }: IconProps,
): JSX.Element {
  const spriteUrl = useContext(IconSpriteContext);
  const style = {
    "--ps-icon-size": `${size}px`,
    color: color ?? "currentColor",
  } as JSX.CSSProperties;
  return (
    <svg aria-hidden="true" className="ps-icon" focusable="false" style={style}>
      <use href={`${spriteUrl}#icon-${name}`} />
    </svg>
  );
}
