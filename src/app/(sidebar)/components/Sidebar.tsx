"use client";

import Avatar from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { cn } from "@/lib/cn";
import { emitSidebarStateChange } from "@/lib/sidebar-events";
import type { User } from "better-auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSidebar } from "../contexts/SidebarContext";
import {
  type SidebarMenuItem,
  type SidebarMenuItemChild,
  setSidebarOpen,
  sidebarMenuItems,
} from "../sidebarMenu";
import styles from "./sidebar.module.scss";

function RootMenuItem({
  item,
  user,
  unreadNotificationCount,
  hasUnreadChat,
}: {
  item: SidebarMenuItem;
  user?: User | null;
  unreadNotificationCount?: number;
  hasUnreadChat?: boolean;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const pathname = usePathname();
  const {
    isOpen,
    setIndicatorTop,
    indicatorAnimated,
    enableIndicatorAnimation,
    setIndicatorVisible,
    setStaticIndicatorVisible,
    staticIndicatorVisible,
  } = useSidebar();

  const isActive =
    pathname === item.match || pathname.startsWith(`${item.match}/`);

  // biome-ignore lint: サイドバー開閉時に位置を再計算
  useEffect(() => {
    if (!isActive || !ref.current) return;

    setIndicatorTop(ref.current.offsetTop);

    if (indicatorAnimated) return;

    requestAnimationFrame(() => {
      enableIndicatorAnimation();
    });
  }, [
    isActive,
    isOpen,
    setIndicatorTop,
    indicatorAnimated,
    enableIndicatorAnimation,
  ]);

  useEffect(() => {
    if (!isActive) return;

    setIndicatorVisible(true);
    setStaticIndicatorVisible(false);

    const timer = setTimeout(() => {
      setIndicatorVisible(false);
      setStaticIndicatorVisible(true);
    }, 250);

    return () => clearTimeout(timer);
  }, [isActive, setIndicatorVisible, setStaticIndicatorVisible]);

  const notifCount =
    item.match === "/notifs" && unreadNotificationCount
      ? unreadNotificationCount
      : 0;
  const showBadge =
    (item.match === "/notifs" && notifCount > 0) ||
    (item.match === "/chat" && hasUnreadChat);

  return (
    <li className={cn(styles.menuItem, isActive && styles.active)} ref={ref}>
      {isActive && (
        <div
          className={cn(
            styles.staticIndicator,
            !staticIndicatorVisible && styles.hidden,
          )}
        >
          <span className={styles.staticIndicatorInner} />
        </div>
      )}
      <Link href={item.href} className={styles.link}>
        <span className={styles.iconWithBadge}>
          {item.match === "/mypage" ? (
            <Avatar
              src={user?.image || null}
              alt={user?.name ? `${user.name}のアイコン` : "ユーザのアイコン"}
              className={styles.sidebarIcon}
            />
          ) : isActive ? (
            item.icon?.active
          ) : (
            item.icon?.inactive
          )}
          {showBadge && (
            <span className={styles.notificationBadge}>
              <Badge value={"1"} hideValue />
            </span>
          )}
        </span>
        <span className={styles.menuText}>{item.label}</span>
      </Link>

      {item.children && (
        <ul className={styles.submenuItems}>
          {item.children.map((child) => (
            <ChildMenuItem key={child.href} item={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

function ChildMenuItem({ item }: { item: SidebarMenuItemChild }) {
  const pathname = usePathname();
  const {
    setIndicatorVisible,
    setStaticIndicatorVisible,
    staticIndicatorVisible,
  } = useSidebar();
  const isActive = pathname === item.href;

  useEffect(() => {
    if (!isActive) return;

    setIndicatorVisible(true);
    setStaticIndicatorVisible(false);

    const timer = setTimeout(() => {
      setIndicatorVisible(false);
      setStaticIndicatorVisible(true);
    }, 250);

    return () => clearTimeout(timer);
  }, [isActive, setIndicatorVisible, setStaticIndicatorVisible]);

  return (
    <li className={cn(styles.submenuItem, isActive && styles.active)}>
      {isActive && (
        <div
          className={cn(
            styles.staticIndicator,
            !staticIndicatorVisible && styles.hidden,
          )}
        >
          <span className={styles.indicatorInner} />
        </div>
      )}
      <Link href={item.href}>{item.label}</Link>
    </li>
  );
}

export default function Sidebar({
  user,
  unreadNotificationCount,
  unreadChatCount,
}: {
  user?: User | null;
  unreadNotificationCount?: number;
  unreadChatCount?: number;
}) {
  const [hasUnreadChat, setHasUnreadChat] = useState(
    !!unreadChatCount && unreadChatCount > 0,
  );

  // 通知の未読件数（サーバーからの初期値 + クライアントイベントの両方を反映）
  const [notifCount, setNotifCount] = useState(unreadNotificationCount ?? 0);

  // サーバーから渡された未読件数が変わった場合も同期しておく
  useEffect(() => {
    setHasUnreadChat(!!unreadChatCount && unreadChatCount > 0);
  }, [unreadChatCount]);

  // サーバーから渡された通知の未読件数が変わった場合も同期
  useEffect(() => {
    setNotifCount(unreadNotificationCount ?? 0);
  }, [unreadNotificationCount]);
  const pathname = usePathname();
  const isTrialPage =
    pathname?.startsWith("/apps/") && pathname.endsWith("/trial");
  const shouldHide = isTrialPage;

  const {
    isOpen,
    toggleOpen,
    indicatorTop,
    indicatorAnimated,
    indicatorVisible,
    setIndicatorTop,
  } = useSidebar();

  // biome-ignore lint: 初期状態通知はマウント時のみ（isInit = true）
  useEffect(() => {
    emitSidebarStateChange(isOpen, true);
  }, []);

  // チャットの未読ルーム数変更イベントを購読してバッジ状態をリアルタイム更新
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (e: Event | CustomEvent<{ unreadRooms: number }>): void => {
      const detail = (e as CustomEvent<{ unreadRooms: number }>).detail;
      const unreadRooms = detail?.unreadRooms ?? 0;
      setHasUnreadChat(unreadRooms > 0);
    };

    window.addEventListener(
      "chat:unread-count-changed",
      handler as EventListener,
    );
    return () => {
      window.removeEventListener(
        "chat:unread-count-changed",
        handler as EventListener,
      );
    };
  }, []);

  // 通知の未読件数変更イベントを購読してバッジ状態をリアルタイム更新
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (e: Event | CustomEvent<{ unreadCount: number }>): void => {
      const detail = (e as CustomEvent<{ unreadCount: number }>).detail;
      const unreadCount = detail?.unreadCount ?? 0;
      setNotifCount(unreadCount);
    };

    window.addEventListener(
      "notifications:unread-count-changed",
      handler as EventListener,
    );

    return () => {
      window.removeEventListener(
        "notifications:unread-count-changed",
        handler as EventListener,
      );
    };
  }, []);

  // biome-ignore lint: サイドバー開閉時に位置を再計算
  useEffect(() => {
    const timer = setTimeout(() => {
      const activeMenuItem = document.querySelector(`li.${styles.active}`);
      if (activeMenuItem && activeMenuItem instanceof HTMLElement) {
        setIndicatorTop(activeMenuItem.offsetTop);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [isOpen, setIndicatorTop]);

  const handleToggle = () => {
    const newIsOpen = !isOpen;
    toggleOpen();
    setSidebarOpen(newIsOpen);
    // 開閉イベントを通知
    emitSidebarStateChange(newIsOpen);
  };

  return (
    <aside
      className={cn(
        styles.sidebar,
        isOpen ? styles.open : styles.closed,
        shouldHide && styles.hidden,
      )}
    >
      <button
        type="button"
        className={styles.sidebarMenuBtn}
        onClick={handleToggle}
      >
        <div className={styles.sidebarMenuLines}>
          <span />
          <span />
          <span />
        </div>
      </button>

      <nav>
        <ul className={styles.menuCont}>
          <li
            className={cn(
              styles.indicator,
              indicatorAnimated && styles.enableTransition,
              indicatorVisible && styles.visible,
            )}
            style={{ transform: `translateY(${indicatorTop}px)` }}
          >
            <span className={styles.indicatorInner} />
          </li>
          {sidebarMenuItems.map((item) => (
            <RootMenuItem
              key={item.href}
              item={item}
              user={user}
              unreadNotificationCount={notifCount}
              hasUnreadChat={hasUnreadChat}
            />
          ))}
        </ul>
      </nav>
    </aside>
  );
}
