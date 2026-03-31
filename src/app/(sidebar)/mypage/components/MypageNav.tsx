"use client";

import { onSidebarStateChange } from "@/lib/sidebar-events";
import { getLocalStorage } from "@/utils/localStorage";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import styles from "./MypageNav.module.scss";

function mapPathToPage(pathname: string): string | null {
  // expected paths: /mypage/purchases, /mypage/wcoin, /mypage/profile, /mypage/settings
  if (!pathname) return null;
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.findIndex((p) => p === "mypage");
  if (idx === -1) return null;
  const sub = parts[idx + 1] || "";
  switch (sub) {
    case "purchases":
    case "products":
      return "apps"; // proto groups app-related pages under apps
    case "wcoin":
      return "w-coin"; // use proto's data-page name
    case "profile":
      return "profile";
    case "settings":
      return "settings";
    default:
      return null;
  }
}

export default function MypageNav() {
  const pathname = usePathname();
  const currentPage = useMemo(() => mapPathToPage(pathname), [pathname]);
  const navRef = useRef<HTMLDivElement | null>(null);

  // 初期表示時のフラッシュ抑制: localStorageのサイドバー状態で即座にクラス適用
  useLayoutEffect(() => {
    const navEl = navRef.current;
    if (!navEl) return;
    try {
      const expanded = getLocalStorage<boolean>("sidebar:isOpen", false);
      if (expanded) {
        // サイドバーが開いている → 初期から非表示（アニメなし）
        navEl.classList.add(styles.isHidden);
        navEl.classList.remove(styles.isHiding);
      } else {
        // サイドバーが閉じている → 初期から表示（アニメなし）
        navEl.classList.remove(styles.isHidden);
        navEl.classList.remove(styles.isHiding);
      }
    } catch {
      // 何もしない（デフォルトは表示）
    }
  }, []);

  useEffect(() => {
    if (!navRef.current) return;
    const navEl = navRef.current;

    let indicatorDelayTimeout: number | undefined;
    let indicatorFastHideTimeout: number | undefined;

    const clearIndicatorDelay = () => {
      if (!navEl) return;
      if (indicatorDelayTimeout !== undefined) {
        window.clearTimeout(indicatorDelayTimeout);
        indicatorDelayTimeout = undefined;
      }
      navEl.classList.remove(styles.indicatorDelay);
    };

    const clearIndicatorFastHide = () => {
      if (!navEl) return;
      if (indicatorFastHideTimeout !== undefined) {
        window.clearTimeout(indicatorFastHideTimeout);
        indicatorFastHideTimeout = undefined;
      }
      navEl.classList.remove(styles.indicatorFastHide);
    };

    function setActiveNavItem(
      disableAnimation = false,
      ignorePrevious = false,
    ) {
      if (!navEl) return;
      const subnavItems = navEl.querySelectorAll<HTMLLIElement>(
        `.${styles.navItem}`,
      );

      const previousPage = sessionStorage.getItem("mpPrevPage") || undefined;

      const currentItem = Array.from(subnavItems).find(
        (item) =>
          item.dataset.page === currentPage ||
          (!currentPage && item.classList.contains(styles.active)),
      );
      const previousItem = previousPage
        ? Array.from(subnavItems).find(
            (item) => item.dataset.page === previousPage,
          )
        : undefined;

      // reset actives
      subnavItems.forEach((item) => {
        item.classList.remove(styles.active);
      });

      const indicator = ensureIndicator(navEl);

      if (currentItem) {
        currentItem.classList.add(styles.active);

        if (disableAnimation) {
          indicator.style.transition = "none";
        } else {
          indicator.style.transition = "top 0.3s ease, left 0.3s ease";
        }

        const currRect = currentItem.getBoundingClientRect();

        if (previousItem && !ignorePrevious) {
          const prevRect = previousItem.getBoundingClientRect();
          // プロト同様: まず前項目の位置・高さを適用し、次フレームで位置のみを遷移
          indicator.style.top = `${prevRect.top}px`;
          indicator.style.left = `${prevRect.left}px`;
          indicator.style.height = `${prevRect.height}px`;

          requestAnimationFrame(() => {
            indicator.style.top = `${currRect.top}px`;
            indicator.style.left = `${currRect.left}px`;
          });

          // 位置の遷移が終わったら、高さを現在項目に合わせて更新（高さはアニメしない）
          const onTransitionEnd = (e: TransitionEvent) => {
            if (e.propertyName === "top" || e.propertyName === "left") {
              indicator.style.transition = "none";
              indicator.style.height = `${currRect.height}px`;
              // 次のフレームで元のトランジションに戻す
              requestAnimationFrame(() => {
                indicator.style.transition = "top 0.3s ease, left 0.3s ease";
              });
              indicator.removeEventListener("transitionend", onTransitionEnd);
            }
          };
          indicator.addEventListener("transitionend", onTransitionEnd);
        } else {
          // 前項目がない場合は、現在項目の位置・高さを即時適用
          indicator.style.top = `${currRect.top}px`;
          indicator.style.left = `${currRect.left}px`;
          indicator.style.height = `${currRect.height}px`;
        }
      }
    }

    function ensureIndicator(container: HTMLElement): HTMLDivElement {
      let indicator = container.querySelector<HTMLDivElement>(
        `.${styles.mypageNavIndicator}`,
      );
      if (!indicator) {
        indicator = document.createElement("div");
        indicator.className = styles.mypageNavIndicator as unknown as string;
        container.appendChild(indicator);
      }
      return indicator;
    }

    function rerunActiveIndicator() {
      let retries = 0;
      const rerunIndicator = () => {
        setActiveNavItem(true, true);
        retries++;
        if (retries < 50) {
          requestAnimationFrame(rerunIndicator);
        }
      };
      rerunIndicator();
    }

    // initial run: animate indicator when possible
    setActiveNavItem(false);

    const onResize = () => setActiveNavItem(true, true);
    window.addEventListener("resize", onResize);

    const unsubscribe = onSidebarStateChange((expanded, isInit) => {
      if (isInit) {
        // 初期表示はアニメ無しで即時反映
        if (expanded) {
          navEl.classList.add(styles.isHidden);
          navEl.classList.remove(styles.isHiding);
        } else {
          navEl.classList.remove(styles.isHidden);
          navEl.classList.remove(styles.isHiding);
          clearIndicatorDelay();
          clearIndicatorFastHide();
          navEl.classList.add(styles.indicatorDelay);
          indicatorDelayTimeout = window.setTimeout(() => {
            navEl.classList.remove(styles.indicatorDelay);
            indicatorDelayTimeout = undefined;
          }, 700);
        }
        // インジケーターは非アニメで初期配置
        setActiveNavItem(true, true);
        return;
      }

      // トグル時はアニメ付きで切り替え
      if (expanded) {
        // Sidebar OPEN -> hide mypage nav
        clearIndicatorDelay();
        clearIndicatorFastHide();
        navEl.classList.add(styles.indicatorFastHide);
        indicatorFastHideTimeout = window.setTimeout(() => {
          navEl.classList.remove(styles.indicatorFastHide);
          indicatorFastHideTimeout = undefined;
        }, 200);
        navEl.classList.add(styles.isHiding);
        // アニメ後に完全に隠す
        const timeout = setTimeout(() => {
          navEl.classList.add(styles.isHidden);
          clearTimeout(timeout);
        }, 320);
      } else {
        // Sidebar CLOSED -> show mypage nav
        // まず縮小状態にして表示再開 → 次フレームで展開アニメ
        navEl.classList.add(styles.isHiding);
        navEl.classList.remove(styles.isHidden);
        clearIndicatorDelay();
        clearIndicatorFastHide();
        navEl.classList.add(styles.indicatorDelay);
        indicatorDelayTimeout = window.setTimeout(() => {
          navEl.classList.remove(styles.indicatorDelay);
          indicatorDelayTimeout = undefined;
        }, 700);
        requestAnimationFrame(() => {
          navEl.classList.remove(styles.isHiding);
          rerunActiveIndicator();
        });
      }
      rerunActiveIndicator();
    });

    return () => {
      window.removeEventListener("resize", onResize);
      // call returned cleanup if provided
      if (typeof unsubscribe === "function") unsubscribe();
      clearIndicatorDelay();
      clearIndicatorFastHide();
    };
  }, [currentPage]);

  // Track previous page for animation
  useEffect(() => {
    const prev = sessionStorage.getItem("mpCurrentPage");
    if (prev) sessionStorage.setItem("mpPrevPage", prev);
    if (currentPage) sessionStorage.setItem("mpCurrentPage", currentPage);
  }, [currentPage]);

  return (
    <nav className={styles.mypageNav} ref={navRef}>
      <ul>
        <li className={styles.navItem} data-page="apps">
          <Link href="/mypage/purchases">
            <Image
              src="/images/mypage-nav/apps.png"
              alt="アプリ一覧"
              width={657}
              height={596}
            />
            <span>アプリ一覧</span>
          </Link>
        </li>
        <li className={styles.navItem} data-page="w-coin">
          <Link href="/mypage/wcoin">
            <Image
              src="/images/w-coin.png"
              alt="Wコイン"
              width={582}
              height={554}
            />
            <span>Wコイン</span>
          </Link>
        </li>
        <li className={styles.navItem} data-page="profile">
          <Link href="/mypage/profile">
            <Image
              src="/images/mypage-nav/profile.png"
              alt="プロフィール"
              width={172}
              height={184}
            />
            <span>プロフィール</span>
          </Link>
        </li>
        <li className={styles.navItem} data-page="settings">
          <Link href="/mypage/settings">
            <Image
              src="/images/mypage-nav/settings.png"
              alt="設定"
              width={199}
              height={198}
            />
            <span>設定</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
