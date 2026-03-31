"use client";

import { useTabIndicator } from "@/app/(sidebar)/components/useTabIndicator";
import clsx from "clsx";
import styles from "./TabBar.module.scss";

export type TabType = "basic" | "notifications" | "list";

type TabBarProps = {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
};

const TABS: { id: TabType; label: string }[] = [
  { id: "basic", label: "基本設定" },
  { id: "notifications", label: "通知設定" },
  { id: "list", label: "リスト" },
];

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const { tabbedRef, indicatorRef } = useTabIndicator<TabType>(activeTab);

  return (
    <div className={styles.tabArea}>
      <div className={styles.tabTop}>
        <div ref={tabbedRef} className={styles.tabbed}>
          <div ref={indicatorRef} className={styles.tabbedIndicator} />

          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={clsx(styles.tabBtn, {
                [styles.activeTab]: activeTab === tab.id,
              })}
              data-tab={tab.id}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
