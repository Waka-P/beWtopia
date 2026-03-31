"use client";

import { cn } from "@/lib/cn";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./SortMenu.module.scss";

export type SortOption<T> = {
  key: string;
  label: string;
  compareFn: (a: T, b: T) => number;
};

type SortMenuProps<T> = {
  items: T[];
  options: SortOption<T>[];
  onChange: (sortedItems: T[]) => void;
  /**
   * The currently active sort key.
   */
  value?: string;
  /**
   * Callback when sort key changes.
   */
  onSortChange?: (key: string) => void;
  /**
   * Close menu when clicking outside
   * @default true
   */
  closeOnOutsideClick?: boolean;
};

export default function SortMenu<T>({
  items,
  options,
  onChange,
  value,
  onSortChange,
  closeOnOutsideClick = true,
}: SortMenuProps<T>) {
  // Options Stabilization: prevent loop when parent passes new array every render
  const optionsRef = useRef(options);
  const optionsChanged =
    options.length !== optionsRef.current.length ||
    options.some((o, i) => o.key !== optionsRef.current[i].key);

  if (optionsChanged) {
    optionsRef.current = options;
  }
  const stableOptions = optionsRef.current;

  // onChange Stabilization: prevent loop when parent passes new function every render
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }); // runs every render to keep ref fresh

  const [internalKey, setInternalKey] = useState(stableOptions[0]?.key);
  const activeKey = value ?? internalKey;

  const [isOpen, setIsOpen] = useState(false);
  const [isAnimated, setIsAnimated] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!closeOnOutsideClick) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, closeOnOutsideClick]);

  const activeOptionIndex = stableOptions.findIndex((o) => o.key === activeKey);
  const safeIndex = activeOptionIndex >= 0 ? activeOptionIndex : 0;
  const activeOption = stableOptions[safeIndex];

  // biome-ignore lint: items や activeKey が変わったらソートして親に通知
  useEffect(() => {
    if (activeOption) {
      const sorted = [...items].sort(activeOption.compareFn);
      onChangeRef.current(sorted);
    }
  }, [items, activeKey, stableOptions, activeOption]);

  // biome-ignore lint: メニュー開閉時のアニメーション制御
  useEffect(() => {
    if (isOpen) {
      setIsAnimated(false);
      // Wait for next frame to ensure "false" propagates to style
      requestAnimationFrame(() => {
        updateSortIndicator(safeIndex);
        // Wait another frame to enable animation
        requestAnimationFrame(() => {
          setIsAnimated(true);
        });
      });
    } else {
      setIsAnimated(false);
    }
  }, [isOpen]); // safeIndexは開いた瞬間の位置としてのみ使用

  // biome-ignore lint: 選択変更時のアニメーション制御
  useEffect(() => {
    if (isOpen) {
      updateSortIndicator(safeIndex);
    }
  }, [safeIndex]); // 項目変更時のみ

  const updateSortIndicator = (index: number) => {
    if (!menuRef.current) return;

    const menuEl = menuRef.current.querySelector(
      `.${styles.menu}`,
    ) as HTMLElement;
    const menuItems = menuRef.current.querySelectorAll(`.${styles.menuItem}`);
    const targetItem = menuItems[index] as HTMLElement;
    const indicator = menuEl?.querySelector(
      `.${styles.indicator}`,
    ) as HTMLElement;

    if (!targetItem || !indicator || !menuEl) return;

    const menuRect = menuEl.getBoundingClientRect();
    const itemRect = targetItem.getBoundingClientRect();

    // Calculate relative position within the .menu container
    const top = itemRect.top - menuRect.top;
    const height = itemRect.height;

    indicator.style.top = `${top}px`;
    indicator.style.height = `${height}px`;
  };

  const handleSort = (key: string) => {
    if (value === undefined) {
      setInternalKey(key);
    }
    onSortChange?.(key);
    // updateSortIndicator(index); // useEffectに任せる
    // setIsOpen(false); // Optional: close on select
  };

  return (
    <div className={styles.container} ref={menuRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="並べ替え"
      >
        <Image src="/images/sort.png" width={30} height={30} alt="並べ替え" />
      </button>
      <div
        className={cn(styles.menu, {
          [styles.show]: isOpen,
        })}
      >
        <div
          className={cn(styles.indicator, {
            [styles.animated]: isAnimated,
          })}
        />
        <ul>
          {stableOptions.map((option) => (
            <li key={option.key}>
              <button
                type="button"
                className={cn(styles.menuItem, {
                  [styles.active]: option.key === activeKey,
                })}
                onClick={() => handleSort(option.key)}
              >
                <span>{option.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// 便利なソート関数ビルダー
export const SortUtils = {
  sortByDateNewest: <T extends { createdAt: string | Date | number }>(
    a: T,
    b: T,
  ) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),

  sortByDateOldest: <T extends { createdAt: string | Date | number }>(
    a: T,
    b: T,
  ) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
};
