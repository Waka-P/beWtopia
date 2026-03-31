"use client";

import CrossPageTabs from "@/app/(sidebar)/components/CrossPageTabs";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import commonStyles from "./common.module.scss";
import {
  SearchHeaderControlsProvider,
  useSearchHeaderControls,
} from "./headerContext";

function SearchLayoutInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isApps = pathname.startsWith("/search/apps");
  const isUsers = pathname.startsWith("/search/users");
  const { controls } = useSearchHeaderControls();

  return (
    <div className={commonStyles.mypageContent}>
      <header className={commonStyles.mypageHeader}>
        <div className={commonStyles.left}>
          <CrossPageTabs
            containerClassName={commonStyles.toggleTabbed}
            indicatorClassName={commonStyles.tabbedIndicator}
            tabButtonClassName={commonStyles.tabBtn}
            tabs={[
              {
                label: "アプリ",
                href: "/search/apps",
                active: isApps,
              },
              {
                label: "ユーザ",
                href: "/search/users",
                active: isUsers,
              },
            ]}
          />
          {controls.left}
        </div>
        <div className={commonStyles.right}>{controls.right}</div>
      </header>
      {children}
    </div>
  );
}

export default function SearchLayout({ children }: { children: ReactNode }) {
  return (
    <SearchHeaderControlsProvider>
      <SearchLayoutInner>{children}</SearchLayoutInner>
    </SearchHeaderControlsProvider>
  );
}
