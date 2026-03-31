"use client";

import SearchBar from "@/app/(sidebar)/components/SearchBar/SearchBar";
import { cn } from "@/lib/cn";
import { getLocalStorage, setLocalStorage } from "@/utils/localStorage";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./BewtsChat.module.scss";
import {
  BewtsChatArea,
  type BewtsChatAreaHandle,
} from "./components/BewtsChatArea";

type Room = {
  id: number;
  name: string;
  isAllRoom: boolean;
  roleId?: number | null;
};

const BEWTS_CHAT_SIDEBAR_WIDTH_STORAGE_KEY = "bewts:chat-sidebar-width";

function normalizeBewtsSidebarWidth(value: number) {
  if (!Number.isFinite(value)) return 300;
  if (value === 0) return 0;
  return Math.max(250, Math.min(700, value));
}

export default function BewtsChatClient({
  project,
  rooms,
  initialRoomId,
  isAdmin,
  userRoleId,
  currentUserName,
}: {
  project: {
    id: number;
    publicId: string;
    name: string;
    memberCount: number;
    totalMemberCount: number;
  };
  rooms: Room[];
  initialRoomId: number | null;
  isAdmin: boolean;
  userRoleId: number | null;
  currentUserName?: string | null;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const prevSelectedRoomIdRef = useRef<number | null>(null);
  const chatAreaRef = useRef<BewtsChatAreaHandle | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(
    initialRoomId,
  );
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    normalizeBewtsSidebarWidth(
      getLocalStorage<number>(BEWTS_CHAT_SIDEBAR_WIDTH_STORAGE_KEY, 300),
    ),
  );
  const [isResizing, setIsResizing] = useState(false);
  const projectTitleRef = useRef<HTMLAnchorElement | null>(null);
  const [projectTitleOverflow, setProjectTitleOverflow] = useState(0);
  const previousClientXRef = useRef<number | null>(null);
  const resizerOffsetRef = useRef<number>(0);
  const paneLeftRef = useRef<number>(0);
  const isMountedRef = useRef(false);

  const COLLAPSE_THRESHOLD = 250;

  const visibleRooms = useMemo(() => {
    if (isAdmin) return rooms;
    return rooms.filter((r: Room) => r.isAllRoom || r.roleId === userRoleId);
  }, [rooms, isAdmin, userRoleId]);

  const selectedRoom =
    rooms.find((r) => r.id === selectedRoomId) ?? visibleRooms[0] ?? null;

  const allRoom = visibleRooms.find((r: Room) => r.isAllRoom) ?? null;
  const roleRooms = visibleRooms.filter((r: Room) => !r.isAllRoom);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        chatAreaRef.current?.focusNextHit();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        chatAreaRef.current?.focusPrevHit();
      }
    },
    [],
  );

  const handleSearchSubmit = useCallback(() => {
    chatAreaRef.current?.focusNextHit();
  }, []);

  useEffect(() => {
    setLocalStorage(BEWTS_CHAT_SIDEBAR_WIDTH_STORAGE_KEY, sidebarWidth);
  }, [sidebarWidth]);

  useEffect(() => {
    const measure = () => {
      const titleEl = projectTitleRef.current;
      if (!titleEl) return;

      setProjectTitleOverflow(
        Math.max(titleEl.scrollWidth - titleEl.clientWidth, 0),
      );
    };

    measure();
    window.addEventListener("resize", measure);

    return () => {
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const params = url.searchParams;

    if (searchQuery) {
      params.set("q", searchQuery);
    } else {
      params.delete("q");
    }

    const newSearch = params.toString();
    const currentPath = `${url.pathname}${url.search}`;
    const nextPath = `${url.pathname}${newSearch ? `?${newSearch}` : ""}`;

    if (currentPath !== nextPath) {
      router.replace(nextPath, { scroll: false });
    }
  }, [searchQuery, router]);

  // keep URL path in sync with the currently selected room
  useEffect(() => {
    if (selectedRoomId == null) return;

    const search = window.location.search || "";
    const nextPath = `/bewts/${project.publicId}/chat/${selectedRoomId}${search}`;
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== nextPath) router.replace(nextPath, { scroll: false });
  }, [selectedRoomId, project.publicId, router]);

  const handleResize = useCallback((e: MouseEvent) => {
    const paneLeft = paneLeftRef.current;
    // ドラッグ開始時のズレを引いて補正することでリサイザー中央が常にカーソルに追従する
    const newWidth = e.clientX - paneLeft - resizerOffsetRef.current;

    const prevX = previousClientXRef.current;
    let direction: "left" | "right" | null = null;
    if (prevX != null) {
      if (e.clientX > prevX) direction = "right";
      else if (e.clientX < prevX) direction = "left";
    }
    previousClientXRef.current = e.clientX;

    if (direction === "right") document.body.style.cursor = "e-resize";
    else if (direction === "left") document.body.style.cursor = "w-resize";
    else document.body.style.cursor = "ew-resize";

    // 折りたたみは左方向ドラッグ時のみ判定（右に引いても誤って閉じない）
    if (direction === "left" && newWidth <= COLLAPSE_THRESHOLD) {
      setSidebarWidth(0);
    } else if (newWidth > COLLAPSE_THRESHOLD) {
      const actualWidth = Math.max(200, Math.min(700, newWidth));
      setSidebarWidth(actualWidth);
    }
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const stopResizing = () => {
      setIsResizing(false);
      previousClientXRef.current = null;
      document.body.style.cursor = "";
    };

    window.addEventListener("mousemove", handleResize);
    window.addEventListener("mouseup", stopResizing);

    return () => {
      window.removeEventListener("mousemove", handleResize);
      window.removeEventListener("mouseup", stopResizing);
      document.body.style.cursor = "";
      previousClientXRef.current = null;
    };
  }, [isResizing, handleResize]);

  const startResizing = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      paneLeftRef.current =
        sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const resizerEl = e.currentTarget;
      const rect = resizerEl.getBoundingClientRect();
      const resizerCenterX = rect.left + rect.width / 2;
      // カーソル位置とリサイザー中央のズレを記録し、幅計算時に補正する
      resizerOffsetRef.current = e.clientX - resizerCenterX;
      previousClientXRef.current = e.clientX;
      setIsResizing(true);
    },
    [],
  );

  // biome-ignore lint: チャットルーム選択に応じてインジケーターの位置を動的に更新
  useEffect(() => {
    const navEl = sidebarRef.current;
    if (!navEl || selectedRoomId == null) return;
    const nav = navEl as HTMLElement;

    function ensureIndicator(container: HTMLElement): HTMLDivElement {
      let indicator = container.querySelector<HTMLDivElement>(
        `.${styles.chatNavIndicator}`,
      );
      if (!indicator) {
        indicator = document.createElement("div");
        indicator.className = styles.chatNavIndicator as unknown as string;
        container.appendChild(indicator);
      }
      return indicator;
    }

    function getOffsetRelativeTo(
      el: HTMLElement,
      ancestor: HTMLElement,
    ): { top: number; left: number } {
      let top = 0;
      let left = 0;
      let current: HTMLElement | null = el;
      while (current && current !== ancestor) {
        top += current.offsetTop;
        left += current.offsetLeft;
        current = current.offsetParent as HTMLElement | null;
      }
      return { top, left };
    }

    function setActiveRoomIndicator(disableAnimation = false) {
      const items = nav.querySelectorAll<HTMLLIElement>(
        `.${styles.chatNavItem}`,
      );
      const itemsArray = Array.from(items) as HTMLLIElement[];
      const currentItem = itemsArray.find(
        (item) => Number(item.dataset.roomId) === selectedRoomId,
      );
      if (!currentItem) return;

      const previousRoomId = prevSelectedRoomIdRef.current;
      const previousItem =
        previousRoomId != null
          ? itemsArray.find(
              (item) => Number(item.dataset.roomId) === previousRoomId,
            )
          : undefined;

      const indicator = ensureIndicator(nav);

      const { top: currTop, left: currOffsetLeft } = getOffsetRelativeTo(
        currentItem,
        nav,
      );
      const currLeft = Math.max(8, currOffsetLeft - 12);
      const currHeight = currentItem.getBoundingClientRect().height;

      // base inline styles
      indicator.style.top = "0";
      indicator.style.left = "0";
      indicator.style.boxSizing = "border-box";
      indicator.style.zIndex = "5";

      if (previousItem && !disableAnimation) {
        const { top: prevTop, left: prevOffsetLeft } = getOffsetRelativeTo(
          previousItem,
          nav,
        );
        const prevLeft = Math.max(8, prevOffsetLeft - 12);
        const prevHeight = previousItem.getBoundingClientRect().height;

        // place instantly at previous position (no transition)
        indicator.className = styles.chatNavIndicator as unknown as string;
        indicator.style.transform = `translate(${prevLeft}px, ${prevTop}px)`;
        indicator.style.height = `${prevHeight}px`;

        // force reflow
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        void indicator.offsetWidth;

        // enable transition and move to target
        requestAnimationFrame(() => {
          indicator.className =
            `${styles.chatNavIndicator} ${styles.enableTransition}` as unknown as string;
          indicator.style.transform = `translate(${currLeft}px, ${currTop}px)`;
          indicator.style.height = `${currHeight}px`;
        });
      } else {
        // immediate positioning
        if (disableAnimation) {
          indicator.className = styles.chatNavIndicator as unknown as string;
        } else {
          indicator.className =
            `${styles.chatNavIndicator} ${styles.enableTransition}` as unknown as string;
        }
        indicator.style.transform = `translate(${currLeft}px, ${currTop}px)`;
        indicator.style.height = `${currHeight}px`;
      }

      prevSelectedRoomIdRef.current = selectedRoomId;
    }

    setActiveRoomIndicator(!isMountedRef.current);
    isMountedRef.current = true;

    const handleResize = () => setActiveRoomIndicator(true);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [selectedRoomId, visibleRooms]);

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <Link
            ref={projectTitleRef}
            href={`/bewts/${project.publicId}`}
            className={cn(
              styles.projectTitle,
              projectTitleOverflow > 0 && styles.marqueeReady,
            )}
            style={
              {
                "--marquee-distance": `${projectTitleOverflow}px`,
              } as React.CSSProperties
            }
          >
            <span className={styles.marqueeText}>{project.name}</span>
          </Link>
          <div className={styles.projectMeta}>
            {project.totalMemberCount}人のメンバー
          </div>
        </div>
        <div className={styles.searchWrapper}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="メッセージを検索"
            onKeyDown={handleSearchKeyDown}
            onSubmit={handleSearchSubmit}
          />
        </div>
      </div>

      <div className={styles.mainLayout}>
        <aside
          className={styles.sidebar}
          ref={sidebarRef}
          style={{ width: sidebarWidth }}
          data-width={sidebarWidth === 0 ? "0" : undefined}
        >
          <button
            type="button"
            className={cn(
              styles.resizer,
              isResizing && styles.active,
              sidebarWidth === 0 && styles.collapsed,
            )}
            onMouseDown={(e) => startResizing(e)}
            aria-label="チャンネル一覧とチャット画面の幅を変更する"
          >
            <span className={styles.handle}></span>
          </button>
          <ul className={styles.channelList}>
            {allRoom && (
              <li
                key={allRoom.id}
                data-room-id={allRoom.id}
                className={cn(
                  styles.channelItem,
                  styles.chatNavItem,
                  allRoom.id === selectedRoomId && styles.channelItemActive,
                )}
              >
                <button
                  type="button"
                  className={styles.channelButton}
                  onClick={() => setSelectedRoomId(allRoom.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      setSelectedRoomId(allRoom.id);
                  }}
                >
                  <div className={styles.channelName}>全体チャット</div>
                </button>
              </li>
            )}
          </ul>

          {roleRooms.length > 0 && (
            <>
              <div className={styles.rolesSectionLabel}>役割別</div>
              <ul className={styles.channelList}>
                {roleRooms.map((r) => (
                  <li
                    key={r.id}
                    data-room-id={r.id}
                    className={cn(
                      styles.channelItem,
                      styles.chatNavItem,
                      r.id === selectedRoomId && styles.channelItemActive,
                    )}
                  >
                    <button
                      type="button"
                      className={styles.channelButton}
                      onClick={() => setSelectedRoomId(r.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ")
                          setSelectedRoomId(r.id);
                      }}
                    >
                      <div className={styles.channelName}>{r.name}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>

        <main className={styles.chatAreaContainer}>
          {selectedRoom ? (
            <BewtsChatArea
              ref={chatAreaRef}
              roomId={selectedRoom.id}
              projectPublicId={project.publicId}
              currProjectId={project.id}
              searchQuery={searchQuery}
              currentUserName={currentUserName}
              chatEditorActionMenuButtons={[]}
            />
          ) : (
            <div className={styles.emptyState}>チャンネルがありません</div>
          )}
        </main>
      </div>
    </div>
  );
}
