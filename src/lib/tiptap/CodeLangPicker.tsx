"use client";

import { useEffect, useRef, useState } from "react";
import { IoIosArrowDown } from "react-icons/io";
import styles from "./CodeLangPicker.module.scss";

type Lang = { value: string; label: string };

type Props = {
  value: string | null;
  languages: Lang[];
  onSelect: (value: string | null) => void;
};

import { useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "../cn";

export default function CodeLangPicker({ value, languages, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!open) return;
      const target = e.target as Node;
      const clickedOnToggle = rootRef.current?.contains(target);
      const clickedOnMenu = menuRef.current?.contains(target);
      if (!clickedOnToggle && !clickedOnMenu) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    setRect(rootRef.current.getBoundingClientRect());

    const onScroll = () => {
      if (rootRef.current) setRect(rootRef.current.getBoundingClientRect());
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const currentLabel =
    (value && languages.find((l) => l.value === value)?.label) || "言語を選択";

  const MENU_MAX_HEIGHT = 200; // px

  const menu = (
    <div
      className={styles.languageMenu}
      role="menu"
      style={
        rect
          ? (() => {
              const topAbove = rect.top + window.scrollY - MENU_MAX_HEIGHT - 16;
              const topBelow = rect.top + rect.height + window.scrollY + 16;
              const top = topAbove >= 8 ? topAbove : topBelow;
              return {
                position: "absolute",
                top,
                left: rect.left + window.scrollX,
                zIndex: 10000,
                minWidth: rect.width,
              } as React.CSSProperties;
            })()
          : undefined
      }
      ref={menuRef}
    >
      <div className={styles.languageMenuWrap}>
        <div
          className={styles.languageMenuScroll}
          style={{ maxHeight: MENU_MAX_HEIGHT }}
        >
          {languages.map((l) => (
            <button
              key={l.value}
              type="button"
              className={cn(
                styles.languageMenuItem,
                value === l.value && styles.languageSelected,
              )}
              onClick={() => {
                onSelect(l.value);
                setOpen(false);
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.languagePicker} ref={rootRef}>
      <button
        type="button"
        className={styles.languagePickerBtn}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {currentLabel}
        <span className={styles.caret} aria-hidden>
          <IoIosArrowDown />
        </span>
      </button>

      {open && rect && createPortal(menu, document.body)}
    </div>
  );
}
