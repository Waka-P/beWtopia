"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

type CrossPageTab = {
  label: string;
  href: string;
  active: boolean;
};

type CrossPageTabsProps = {
  tabs: CrossPageTab[];
  containerClassName: string;
  indicatorClassName: string;
  tabButtonClassName: string;
};

export default function CrossPageTabs({
  tabs,
  containerClassName,
  indicatorClassName,
  tabButtonClassName,
}: CrossPageTabsProps) {
  const tabbedRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!tabbedRef.current || !indicatorRef.current) return;

    const tabsElements =
      tabbedRef.current.querySelectorAll<HTMLElement>("[data-tab-index]");
    const activeIndex = tabs.findIndex((tab) => tab.active);
    const activeTab = activeIndex >= 0 ? tabsElements[activeIndex] : null;
    if (!activeTab) return;

    const indicator = indicatorRef.current;
    const containerRect = tabbedRef.current.getBoundingClientRect();
    const activeRect = activeTab.getBoundingClientRect();

    const targetLeft = activeRect.left - containerRect.left;
    const targetTop = activeRect.top - containerRect.top;
    const targetWidth = activeRect.width;
    const targetHeight = activeRect.height;

    const isFirstRender = !indicator.style.width;

    if (isFirstRender) {
      indicator.style.transition = "none";
      indicator.style.left = `${targetLeft}px`;
      indicator.style.top = `${targetTop}px`;
      indicator.style.width = `${targetWidth}px`;
      indicator.style.height = `${targetHeight}px`;
      indicator.style.opacity = "1";

      requestAnimationFrame(() => {
        indicator.style.transition = "all 300ms ease";
      });
    } else {
      indicator.style.transition = "all 300ms ease";
      indicator.style.left = `${targetLeft}px`;
      indicator.style.top = `${targetTop}px`;
      indicator.style.width = `${targetWidth}px`;
      indicator.style.height = `${targetHeight}px`;
      indicator.style.opacity = "1";
    }
  }, [tabs]);

  return (
    <div ref={tabbedRef} className={containerClassName}>
      <div ref={indicatorRef} className={indicatorClassName} />
      {tabs.map((tab, index) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={tabButtonClassName}
          data-tab-index={index}
          data-active={tab.active ? "" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
