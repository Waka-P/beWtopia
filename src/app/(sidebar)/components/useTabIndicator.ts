"use client";

import { useCallback, useEffect, useRef } from "react";

export function useTabIndicator<T extends string | number>(activeTab: T) {
  const tabbedRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);

  const updateTabIndicator = useCallback(() => {
    if (!tabbedRef.current || !indicatorRef.current) return;

    const container = tabbedRef.current;
    const indicator = indicatorRef.current;
    const activeEl = container.querySelector(
      `[data-tab="${String(activeTab)}"]`,
    ) as HTMLElement | null;

    if (!activeEl) return;

    const containerRect = container.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();

    const left = activeRect.left - containerRect.left;
    const top = activeRect.top - containerRect.top;
    const width = activeRect.width;
    const height = activeRect.height;

    indicator.style.left = `${left}px`;
    indicator.style.top = `${top}px`;
    indicator.style.width = `${width}px`;
    indicator.style.height = `${height}px`;
    indicator.style.opacity = "1";
  }, [activeTab]);

  useEffect(() => {
    updateTabIndicator();
  }, [updateTabIndicator]);

  useEffect(() => {
    window.addEventListener("resize", updateTabIndicator);
    return () => window.removeEventListener("resize", updateTabIndicator);
  }, [updateTabIndicator]);

  return { tabbedRef, indicatorRef, updateTabIndicator };
}
