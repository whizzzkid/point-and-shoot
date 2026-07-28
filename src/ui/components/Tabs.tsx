/// <reference lib="dom" />

import type { JSX } from "preact";
import { useRef, useState } from "preact/hooks";

/** Props accepted by {@link Tabs}. */
export interface TabsProps {
  readonly tabs: readonly string[];
  readonly active?: string;
  readonly onChange?: (tab: string) => void;
}

/**
 * Renders an underline tab list with wrapping arrow-key navigation.
 *
 * @param props Tab labels, optional controlled selection, and change callback.
 * @returns The tab list.
 */
export function Tabs({ tabs, active, onChange }: TabsProps): JSX.Element {
  const [uncontrolledActive, setUncontrolledActive] = useState(tabs[0]);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = active ?? (
    uncontrolledActive !== undefined && tabs.includes(uncontrolledActive)
      ? uncontrolledActive
      : tabs[0]
  );

  function activate(index: number): void {
    const tab = tabs[index];
    if (tab === undefined) return;
    if (active === undefined) setUncontrolledActive(tab);
    onChange?.(tab);
    tabRefs.current[index]?.focus();
  }

  function handleKeyDown(
    event: JSX.TargetedKeyboardEvent<HTMLButtonElement>,
    index: number,
  ): void {
    if (tabs.length === 0) return;

    let nextIndex: number | undefined;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    activate(nextIndex);
  }

  return (
    <div aria-label="Sections" className="ps-tabs" role="tablist">
      {tabs.map((tab, index) => (
        <button
          aria-selected={tab === selected}
          className="ps-tabs__tab"
          key={tab}
          onClick={() => activate(index)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          ref={(element) => {
            tabRefs.current[index] = element;
          }}
          role="tab"
          tabIndex={tab === selected ? 0 : -1}
          type="button"
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
