"use client";

import CrossPageTabs from "@/app/(sidebar)/components/CrossPageTabs";
import MypageNav from "@/app/(sidebar)/mypage/components/MypageNav";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  MypageAppsHeaderControlsProvider,
  useMypageAppsHeaderControls,
} from "./appsHeaderContext";
import styles from "./layout.module.scss";
import tabsStyles from "./purchases/page.module.scss";

function MypageLayoutInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPurchases = pathname.startsWith("/mypage/purchases");
  const isProducts = pathname.startsWith("/mypage/products");
  const showTabs = isPurchases || isProducts;
  const { controls } = useMypageAppsHeaderControls();

  return (
    <div className={styles.mypageLayout}>
      <MypageNav />
      <div className={styles.mypageContent}>
        {showTabs && (
          <header className={tabsStyles.mypageHeader}>
            <div className={tabsStyles.left}>
              <CrossPageTabs
                containerClassName={tabsStyles.toggleTabbed}
                indicatorClassName={tabsStyles.tabbedIndicator}
                tabButtonClassName={tabsStyles.tabBtn}
                tabs={[
                  {
                    label: "購入一覧",
                    href: "/mypage/purchases",
                    active: isPurchases,
                  },
                  {
                    label: "出品一覧",
                    href: "/mypage/products",
                    active: isProducts,
                  },
                ]}
              />
              {controls.left}
            </div>
            <div className={tabsStyles.right}>{controls.right}</div>
          </header>
        )}
        {children}
      </div>
    </div>
  );
}

export default function MypageLayout({ children }: { children: ReactNode }) {
  return (
    <MypageAppsHeaderControlsProvider>
      <MypageLayoutInner>{children}</MypageLayoutInner>
    </MypageAppsHeaderControlsProvider>
  );
}
