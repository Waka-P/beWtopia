"use client";

import SearchBar from "@/app/(sidebar)/components/SearchBar/SearchBar";
import Avatar from "@/components/Avatar";
import { UserConfirmModal } from "@/components/BlockUserConfirmModal";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { formatTimeAgo } from "@/utils/date";
import { fetcher } from "@/utils/fetcher";
import { getLocalStorage, setLocalStorage } from "@/utils/localStorage";
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IoIosArrowForward,
  IoIosEyeOff,
  IoIosNotificationsOff,
} from "react-icons/io";
import { TiDeleteOutline } from "react-icons/ti";
import Emoji from "../../components/Emoji";
import styles from "./ChatList.module.scss";

type User = {
  id: number;
  publicId: string;
  name: string;
  image: string | null;
};

type ChatRoom = {
  id: number;
  publicId: string;
  lastMessage?: {
    content: string | null;
    createdAt: string;
    attachments?: { type: string; name?: string | null }[];
    isOrder?: boolean;
    isOwnOrder?: boolean;
    isScout?: boolean;
    isOwnScout?: boolean;
    isOwn?: boolean; // 追加: isOwnScout/isOwnOrder欠損時の補助
  } | null;
  members: {
    userId?: number; // サーバーから来る場合がある
    deletedAt?: string | null; // ChatRoomMember.deletedAt（ISO string）
    isHidden?: boolean; // ChatRoomMember.isHidden
    user: User;
  }[];
  opponent?: User;
  unreadCount?: number; // 未読メッセージ件数
};

// --- helper functions for message preview -------------------------------------------------
function extractEmojiListFromHtml(html: string): string[] {
  if (!html) return [];
  try {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;

    let hasNonEmoji = false;
    let foundEmojiCount = 0;

    const walk = (node: ChildNode) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if ((node.textContent || "").trim() !== "") hasNonEmoji = true;
        return;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (el.getAttribute("data-type") === "emoji") {
          foundEmojiCount++;
          return;
        }

        if (
          el.tagName === "P" ||
          el.tagName === "SPAN" ||
          el.tagName === "DIV"
        ) {
          Array.from(el.childNodes).forEach(walk);
          return;
        }

        hasNonEmoji = true;
      }
    };

    Array.from(wrapper.childNodes).forEach(walk);

    if (hasNonEmoji || foundEmojiCount === 0) return [];

    return Array.from(wrapper.querySelectorAll('[data-type="emoji"]'))
      .map((el) => el.getAttribute("data-emoji") || "")
      .filter(Boolean);
  } catch {
    return [];
  }
}

function renderEmojiRow(emojis: string[]) {
  const seen: Record<string, number> = {};
  const nodes = emojis.slice(0, 6).map((e) => {
    seen[e] = (seen[e] || 0) + 1;
    return { key: `${e}-${seen[e]}`, emoji: e };
  });

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {nodes.map((n) => (
        <Emoji key={n.key} emoji={n.emoji} size={18} style="apple" />
      ))}
    </div>
  );
}

function looksLikeScoutMessageHtml(html: string): boolean {
  if (!html) return false;
  try {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;

    if (wrapper.querySelector('[data-bewts-scout="1"]')) return true;

    const text = (wrapper.textContent || "").replace(/\s+/g, " ").trim();
    return text.includes("スカウト") && text.includes("プロジェクト：");
  } catch {
    return false;
  }
}

function looksLikeOrderMessageHtml(html: string): boolean {
  if (!html) return false;
  try {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;

    if (wrapper.querySelector('[data-bewts-order="1"]')) return true;

    const text = (wrapper.textContent || "").replace(/\s+/g, " ").trim();
    return (
      text.includes("オーダー") &&
      (text.includes("希望金額") || text.includes("希望納期"))
    );
  } catch {
    return false;
  }
}

function getMessagePreview(
  lastMessage: ChatRoom["lastMessage"] | undefined,
  opponentName: string | undefined,
  htmlToTextFn: (html: string) => string,
) {
  const contentHtml = lastMessage?.content || "";

  // フラグが欠けてもHTMLからフォールバック判定
  const isScoutMessage =
    Boolean(lastMessage?.isScout) || looksLikeScoutMessageHtml(contentHtml);
  if (isScoutMessage) {
    const isOwnScout = lastMessage?.isOwnScout ?? lastMessage?.isOwn ?? false;
    return isOwnScout ? "スカウトしました" : "スカウトされました";
  }

  const isOrderMessage =
    Boolean(lastMessage?.isOrder) || looksLikeOrderMessageHtml(contentHtml);
  if (isOrderMessage) {
    const isOwnOrder = lastMessage?.isOwnOrder ?? lastMessage?.isOwn ?? false;
    return isOwnOrder ? "オーダーしました" : "オーダーされました";
  }

  const text = htmlToTextFn(contentHtml);
  const attachments = lastMessage?.attachments || [];

  const emojis = extractEmojiListFromHtml(contentHtml);

  if (emojis.length > 0 && text.trim() === "" && attachments.length === 0) {
    return renderEmojiRow(emojis);
  }

  if (text.trim().length > 0) return text;

  if (attachments.length > 0) {
    const hasNonImage = attachments.some(
      (a) => !(a.type || "").startsWith("image"),
    );
    return hasNonImage ? "ファイルが送信されました" : "画像が送信されました";
  }

  return `${opponentName}さんと話しましょう！`;
}

// -----------------------------------------------------------------------------------------

type Props = {
  initialRooms?: ChatRoom[];
};

const CHAT_LIST_WIDTH_STORAGE_KEY = "chat:list-width";

function normalizeChatListWidth(value: number) {
  if (!Number.isFinite(value)) return 300;
  if (value === 0) return 0;
  return Math.max(250, Math.min(700, value));
}

export default function ChatList({ initialRooms }: Props) {
  const [rooms, setRooms] = useState<ChatRoom[]>(initialRooms ?? []);
  const [width, setWidth] = useState(() =>
    normalizeChatListWidth(
      getLocalStorage<number>(CHAT_LIST_WIDTH_STORAGE_KEY, 340),
    ),
  );
  const [query, setQuery] = useState("");
  const [userResults, setUserResults] = useState<User[]>([]);
  const [isResizing, setIsResizing] = useState(false);
  const [isScrollingChatList, setIsScrollingChatList] = useState(false);
  const [isDraggingScrollbar, setIsDraggingScrollbar] = useState(false);
  const [isHoveringChatList, setIsHoveringChatList] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const previousClientXRef = useRef<number | null>(null);
  const resizerOffsetRef = useRef<number>(0);
  const paneLeftRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chatPaneRef = useRef<HTMLDivElement | null>(null);
  const chatListRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const currentUserPublicId = session?.user?.publicId;

  const COLLAPSE_THRESHOLD = 250;

  const showScrollbar =
    isScrollingChatList ||
    isDraggingScrollbar ||
    (isHoveringChatList && hasScrolled && !isResizing);

  useEffect(() => {
    setLocalStorage(CHAT_LIST_WIDTH_STORAGE_KEY, width);
  }, [width]);

  const onScrollChatList = () => {
    setIsScrollingChatList(true);
    setHasScrolled(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsScrollingChatList(false);
    }, 500);
  };

  // HTMLをプレーンテキストに変換（改行タグは半角スペースに）
  const htmlToText = useCallback((html: string): string => {
    return html
      .replace(/<br\s*\/?>/gi, " ") // <br>を半角スペースに
      .replace(/<\/p>/gi, " ") // </p>も半角スペースに
      .replace(/<[^>]+>/g, "") // その他のHTMLタグを除去
      .replace(/\s+/g, " ") // 連続する空白を1つに
      .trim();
  }, []);

  // pathname から現在のルーム publicId を抽出
  const getCurrentRoomPublicId = useCallback(() => {
    const match = pathname.match(/^\/chat\/([^/]+)$/);
    return match ? match[1] : null;
  }, [pathname]);

  // クライアント側で即座にフィルタリング（ちらつき防止）
  const visibleRooms = useMemo(() => {
    if (!currentUserPublicId) return rooms;

    const currentRoomPublicId = getCurrentRoomPublicId();

    return rooms.filter((room) => {
      const myMember = room.members.find(
        (m) => m.user.publicId === currentUserPublicId,
      );

      // 非表示ルームは表示しない
      if (myMember?.isHidden) return false;

      const deletedAt = myMember?.deletedAt;

      if (!deletedAt) return true; // 削除されていない

      const isCurrentRoom = room.publicId === currentRoomPublicId;
      const hasMessageAfterDelete =
        room.lastMessage &&
        new Date(room.lastMessage.createdAt).getTime() >
          new Date(deletedAt).getTime();

      // 削除時点以降にメッセージがあれば復活して表示
      if (hasMessageAfterDelete) return true;

      // メッセージがない、または削除時点以前のメッセージのみ → 現在アクセス中のルームのみ表示
      return isCurrentRoom;
    });
  }, [rooms, currentUserPublicId, getCurrentRoomPublicId]);

  useEffect(() => {
    const el = chatListRef.current;
    if (!el) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.offsetX > el.clientWidth) {
        setIsDraggingScrollbar(true);
        if (timerRef.current) clearTimeout(timerRef.current); // タイマー停止
      }
    };

    const onMouseUp = () => {
      if (isDraggingScrollbar) {
        setIsDraggingScrollbar(false);
        // ドラッグ終了後、通常のフェードアウトタイマー再開
        timerRef.current = setTimeout(() => {
          setIsScrollingChatList(false);
        }, 1500);
      }
    };

    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDraggingScrollbar]);

  useEffect(() => {
    // If initialRooms provided from server, use it and skip client fetch.
    if (initialRooms && initialRooms.length > 0) {
      setRooms(initialRooms);
      return;
    }

    const currentRoomPublicId = getCurrentRoomPublicId();
    const url = currentRoomPublicId
      ? `/api/chat/rooms?currentRoomPublicId=${encodeURIComponent(currentRoomPublicId)}`
      : "/api/chat/rooms";

    fetcher<ChatRoom[]>(url)
      .then((data) => {
        if (Array.isArray(data)) {
          setRooms(data);
        }
      })
      .catch((err) => console.error("Failed to fetch rooms", err));
  }, [initialRooms, getCurrentRoomPublicId]);

  // rooms の未読件数から「未読ルームが存在するか」を算出し、サイドバーに通知
  useEffect(() => {
    if (typeof window === "undefined") return;

    const unreadRooms = rooms.filter((r) => (r.unreadCount ?? 0) > 0).length;

    window.dispatchEvent(
      new CustomEvent("chat:unread-count-changed", {
        detail: { unreadRooms },
      }),
    );
  }, [rooms]);

  useEffect(() => {
    if (!query) {
      setUserResults([]);
      return;
    }

    const timer = setTimeout(() => {
      fetcher<User[]>(`/api/search/users?q=${encodeURIComponent(query)}`)
        .then((data) => {
          if (Array.isArray(data)) {
            setUserResults(data);
          }
        })
        .catch((err) => console.error("Failed to search users", err));
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  const handleResize = useCallback((e: MouseEvent) => {
    const paneLeft = paneLeftRef.current;
    // ドラッグ開始時のズレを引いて補正することでリサイザー中央が常にカーソルに追従する
    const newWidth = e.clientX - paneLeft - resizerOffsetRef.current;

    // カーソル方向の判定（前回の clientX と比較）
    const prevX = previousClientXRef.current;
    let direction: "left" | "right" | null = null;
    if (prevX != null) {
      if (e.clientX > prevX) direction = "right";
      else if (e.clientX < prevX) direction = "left";
    }
    previousClientXRef.current = e.clientX;

    // ドラッグ方向に応じたカーソルを設定
    if (direction === "right") document.body.style.cursor = "e-resize";
    else if (direction === "left") document.body.style.cursor = "w-resize";
    else document.body.style.cursor = "ew-resize";

    // 折りたたみは左方向ドラッグ時のみ判定（右に引いても誤って閉じない）
    if (direction === "left" && newWidth <= COLLAPSE_THRESHOLD) {
      setWidth(0);
    } else if (newWidth > COLLAPSE_THRESHOLD) {
      const actualWidth = Math.max(200, Math.min(600, newWidth));
      setWidth(actualWidth);
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
      // 何かの理由でクリーンアップが走らなかった場合に備えて、カーソルを戻す
      document.body.style.cursor = "";
      previousClientXRef.current = null;
    };
  }, [isResizing, handleResize]);

  const startResizing = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      paneLeftRef.current =
        chatPaneRef.current?.getBoundingClientRect().left ?? 0;
      const rect = e.currentTarget.getBoundingClientRect();
      const resizerCenterX = rect.left + rect.width / 2;
      // カーソル位置とリサイザー中央のズレを記録し、幅計算時に補正する
      resizerOffsetRef.current = e.clientX - resizerCenterX;
      previousClientXRef.current = e.clientX;
      setIsResizing(true);
    },
    [],
  );

  const handleUserSelect = useCallback(
    async (user: User) => {
      // Check if room exists with this user
      const existingRoom = rooms.find((r) =>
        r.members.some((m) => m.user.publicId === user.publicId),
      );
      if (existingRoom) {
        // 既存ルームがある場合: visibility API を使って非表示を解除してチャットへ移動し、一覧を更新
        try {
          await fetcher(`/api/chat/rooms/${existingRoom.publicId}/visibility`, {
            method: "POST",
            body: JSON.stringify({ isHidden: false }),
          }).catch(() => {
            /* noop - idempotent */
          });

          router.push(`/chat/${existingRoom.publicId}`);

          // 一覧を再取得して最新状態を反映
          const currentRoomPublicId = existingRoom.publicId;
          const url = `/api/chat/rooms?currentRoomPublicId=${encodeURIComponent(currentRoomPublicId)}`;
          const updatedRooms = await fetcher<ChatRoom[]>(url);
          if (Array.isArray(updatedRooms)) setRooms(updatedRooms);
          setQuery("");
        } catch (e) {
          console.error("Failed to open existing room", e);
        }
      } else {
        // Create new room
        try {
          const newRoom = await fetcher<{ id: number; publicId: string }>(
            "/api/chat/rooms",
            {
              method: "POST",
              body: JSON.stringify({ targetUserId: user.publicId }),
            },
          );
          if (newRoom?.publicId) {
            router.push(`/chat/${newRoom.publicId}`);
            // Refresh rooms
            const currentRoomPublicId = newRoom.publicId;
            const url = `/api/chat/rooms?currentRoomPublicId=${encodeURIComponent(currentRoomPublicId)}`;
            const updatedRooms = await fetcher<ChatRoom[]>(url);
            if (Array.isArray(updatedRooms)) setRooms(updatedRooms);
            setQuery("");
          }
        } catch (e) {
          console.error("Failed to create room", e);
        }
      }
    },
    [rooms, router],
  );

  // --- action menu (floating-ui) state & hooks -------------------------------------------------
  const [openMenuRoomId, setOpenMenuRoomId] = useState<number | null>(null);
  const [renderMenuRoomId, setRenderMenuRoomId] = useState<number | null>(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const menuAnimationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const menuVisibilityRafRef = useRef<number | null>(null);
  const actionMenuButtonRefs = useRef<Record<number, HTMLButtonElement | null>>(
    {},
  );

  // --- hide / delete modal state ---------------------------------------------------------
  const [hideModalRoomId, setHideModalRoomId] = useState<number | null>(null);
  const [hideModalOpponent, setHideModalOpponent] = useState<User | null>(null);
  const [hideProcessing, setHideProcessing] = useState(false);

  const [deleteModalRoomId, setDeleteModalRoomId] = useState<number | null>(
    null,
  );
  const [deleteModalOpponent, setDeleteModalOpponent] = useState<User | null>(
    null,
  );
  const [deleteProcessing, setDeleteProcessing] = useState(false);
  // ---------------------------------------------------------------------------------------

  const { refs: menuRefs, floatingStyles: menuFloatingStyles } = useFloating({
    elements: {
      reference:
        renderMenuRoomId !== null
          ? (actionMenuButtonRefs.current[renderMenuRoomId] ?? undefined)
          : undefined,
    },
    open: renderMenuRoomId !== null,
    placement: "bottom-end",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip({ fallbackPlacements: ["bottom-start", "top-end", "top-start"] }),
      shift({ padding: 8 }),
    ],
  });

  // close menu on outside click / Escape
  useEffect(() => {
    if (openMenuRoomId === null) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const refEl = actionMenuButtonRefs.current[openMenuRoomId];
      const floatingEl = menuRefs.floating.current;
      if (!floatingEl) return;
      if (!(e.target instanceof Node)) return;

      const targetNode = e.target as Node;
      const clickedOnReference =
        refEl instanceof HTMLElement && refEl.contains(targetNode);
      const clickedOnFloating =
        floatingEl instanceof HTMLElement && floatingEl.contains(targetNode);

      if (!clickedOnReference && !clickedOnFloating) {
        setOpenMenuRoomId(null);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenuRoomId(null);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenuRoomId, menuRefs]);

  // biome-ignore lint: ルーム切り替え時にメニューを閉じる
  useEffect(() => {
    setOpenMenuRoomId(null);
  }, [pathname]);

  useEffect(() => {
    if (menuAnimationTimerRef.current) {
      clearTimeout(menuAnimationTimerRef.current);
      menuAnimationTimerRef.current = null;
    }
    if (menuVisibilityRafRef.current !== null) {
      cancelAnimationFrame(menuVisibilityRafRef.current);
      menuVisibilityRafRef.current = null;
    }

    if (openMenuRoomId !== null) {
      // まず透明状態で描画し、次フレームで visible にして fade-in を確実に発火させる
      setIsMenuVisible(false);
      setRenderMenuRoomId(openMenuRoomId);
      menuVisibilityRafRef.current = requestAnimationFrame(() => {
        menuVisibilityRafRef.current = requestAnimationFrame(() => {
          setIsMenuVisible(true);
          menuVisibilityRafRef.current = null;
        });
      });
      return;
    }

    setIsMenuVisible(false);
    menuAnimationTimerRef.current = setTimeout(() => {
      setRenderMenuRoomId(null);
    }, 200);

    return () => {
      if (menuAnimationTimerRef.current) {
        clearTimeout(menuAnimationTimerRef.current);
        menuAnimationTimerRef.current = null;
      }
      if (menuVisibilityRafRef.current !== null) {
        cancelAnimationFrame(menuVisibilityRafRef.current);
        menuVisibilityRafRef.current = null;
      }
    };
  }, [openMenuRoomId]);

  const openMenuRoom = useMemo(() => {
    if (renderMenuRoomId === null) return null;
    return rooms.find((r) => r.id === renderMenuRoomId) ?? null;
  }, [renderMenuRoomId, rooms]);

  // Pathname が変わったらサーバーの状態を再取得して反映（削除済みルームの表示制御）
  // biome-ignore lint: pathname が変わったときにルーム一覧を更新する必要がある
  useEffect(() => {
    const fetchAndSetRooms = async () => {
      try {
        const currentRoomPublicId = getCurrentRoomPublicId();
        const url = currentRoomPublicId
          ? `/api/chat/rooms?currentRoomPublicId=${encodeURIComponent(currentRoomPublicId)}`
          : "/api/chat/rooms";
        const data = await fetcher<ChatRoom[]>(url);
        if (Array.isArray(data)) setRooms(data);
      } catch (e) {
        console.error("Failed to refresh rooms", e);
      }
    };

    fetchAndSetRooms();
  }, [pathname, getCurrentRoomPublicId]);

  // 外部イベント（ChatArea 等）からの更新通知を受けて一覧を再取得
  useEffect(() => {
    const handler = () => {
      const currentRoomPublicId = getCurrentRoomPublicId();
      const url = currentRoomPublicId
        ? `/api/chat/rooms?currentRoomPublicId=${encodeURIComponent(currentRoomPublicId)}`
        : "/api/chat/rooms";
      fetcher<ChatRoom[]>(url)
        .then((data) => {
          if (Array.isArray(data)) setRooms(data);
        })
        .catch(() => {});
    };

    window.addEventListener("chat:rooms-updated", handler);
    return () => window.removeEventListener("chat:rooms-updated", handler);
  }, [getCurrentRoomPublicId]);

  const handleConfirmHide = useCallback(async () => {
    if (!hideModalRoomId) return;
    const room = rooms.find((r) => r.id === hideModalRoomId);
    if (!room) {
      setHideModalRoomId(null);
      return;
    }

    setHideProcessing(true);
    try {
      await fetcher(`/api/chat/rooms/${room.publicId}/visibility`, {
        method: "POST",
        body: JSON.stringify({ isHidden: true }),
      });

      // 非表示にしたルームを除いた残りのルーム
      const remainingRooms = rooms.filter((r) => r.id !== hideModalRoomId);
      setRooms(remainingRooms);

      if (pathname === `/chat/${room.publicId}`) {
        // 残りのルームがあれば最初のルームへ、なければ /chat（プレースホルダ表示）
        const nextRoom = remainingRooms[0];
        if (nextRoom) {
          router.push(`/chat/${nextRoom.publicId}`);
        } else {
          // ルームが0件 → ChatPage がリダイレクトしないようサーバー側も修正済みなので安全
          router.push("/chat");
        }
      }
    } catch (err) {
      console.error("Failed to hide room", err);
    } finally {
      setHideProcessing(false);
      setHideModalRoomId(null);
      setOpenMenuRoomId(null);
    }
  }, [hideModalRoomId, rooms, pathname, router]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteModalRoomId) return;
    const room = rooms.find((r) => r.id === deleteModalRoomId);
    if (!room) {
      setDeleteModalRoomId(null);
      return;
    }

    setDeleteProcessing(true);
    try {
      await fetcher(`/api/chat/rooms/${room.publicId}`, { method: "DELETE" });

      // 削除後、サーバーから最新のルーム一覧を取得
      // 削除したルームは現在アクセス中の場合のみ表示される
      const currentRoomPublicId = room.publicId;
      const url = `/api/chat/rooms?currentRoomPublicId=${encodeURIComponent(currentRoomPublicId)}`;
      const updatedRooms = await fetcher<ChatRoom[]>(url);
      if (Array.isArray(updatedRooms)) setRooms(updatedRooms);
      const remainingRooms = updatedRooms;

      if (pathname === `/chat/${room.publicId}`) {
        // 残りのルームがあれば最初のルームへ、なければ /chat（プレースホルダ表示）
        const nextRoom = remainingRooms[0];
        if (nextRoom) {
          router.push(`/chat/${nextRoom.publicId}`);
        } else {
          // ルームが0件 → ChatPage がリダイレクトしないようサーバー側も修正済みなので安全
          router.push("/chat");
        }
      }
    } catch (err) {
      console.error("Failed to delete room", err);
    } finally {
      setDeleteProcessing(false);
      setDeleteModalRoomId(null);
      setOpenMenuRoomId(null);
    }
  }, [deleteModalRoomId, rooms, pathname, router]);

  // ---------------------------------------------------------------------------------------------

  return (
    <div
      ref={chatPaneRef}
      className={styles.chatList}
      style={{ width }}
      data-width={width === 0 ? "0" : undefined}
    >
      <button
        type="button"
        className={cn(
          styles.resizer,
          isResizing && styles.active,
          width === 0 && styles.collapsed,
        )}
        onMouseDown={(e) => startResizing(e)}
        aria-label="チャット一覧とチャット画面の幅を変更する"
      >
        <span className={styles.handle}></span>
      </button>

      <div className={styles.searchContainer}>
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="ユーザーを検索"
        />
      </div>

      {/* biome-ignore lint: divを使用 */}
      <div
        ref={chatListRef}
        onScroll={onScrollChatList}
        onMouseEnter={() => setIsHoveringChatList(true)}
        onMouseLeave={() => setIsHoveringChatList(false)}
        className={cn(styles.list, showScrollbar && styles.scrolling)}
      >
        {query && userResults.length > 0 && (
          <div
            style={{ padding: "10px 20px", color: "#7a8a99", fontSize: "12px" }}
          >
            検索結果
          </div>
        )}
        {query &&
          userResults.map((user) => (
            <button
              type="button"
              key={user.publicId}
              className={cn(styles.chatItem, styles.search)}
              onClick={() => handleUserSelect(user)}
            >
              <Avatar
                src={user.image}
                alt={user.name}
                className={styles.avatar}
              />
              <div className={styles.info}>
                <div className={styles.name}>{user.name}</div>
              </div>
              <IoIosArrowForward className={styles.selectSearchedUserIcon} />
            </button>
          ))}

        {(!query || userResults.length === 0) &&
          visibleRooms.map((room) => {
            const opponent = room.opponent || room.members[0]?.user;
            const isActive = pathname === `/chat/${room.publicId}`;
            return (
              <Link
                key={room.id}
                href={`/chat/${room.publicId}`}
                className={cn(
                  styles.chatItem,
                  isActive && styles.active,
                  (openMenuRoomId === room.id ||
                    renderMenuRoomId === room.id) &&
                    styles.menuOpen,
                )}
              >
                <Avatar
                  src={opponent?.image}
                  alt={opponent?.name}
                  className={styles.avatar}
                />
                <div className={styles.info}>
                  <div className={styles.header}>
                    <div className={styles.name}>
                      {opponent?.name || "Unknown"}
                    </div>
                    {room.lastMessage && (
                      <div className={styles.time}>
                        {formatTimeAgo(room.lastMessage.createdAt)}
                      </div>
                    )}
                  </div>
                  <div className={styles.footer}>
                    <div className={styles.preview}>
                      {getMessagePreview(
                        room.lastMessage,
                        opponent?.name,
                        htmlToText,
                      )}
                    </div>
                    {room.unreadCount && room.unreadCount > 0 ? (
                      <span
                        className={styles.unreadCount}
                        title={`未読 ${room.unreadCount} 件`}
                      >
                        <span className={styles.inner}>
                          {room.unreadCount > 99 ? "99+" : room.unreadCount}
                        </span>
                      </span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  ref={(el) => {
                    actionMenuButtonRefs.current[room.id] = el;
                  }}
                  className={styles.actionMenuBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const isOpen = openMenuRoomId === room.id;
                    if (isOpen) {
                      setOpenMenuRoomId(null);
                    } else {
                      setOpenMenuRoomId(room.id);
                    }
                  }}
                  aria-haspopup="menu"
                  aria-expanded={openMenuRoomId === room.id}
                >
                  <span className={styles.dot}></span>
                  <span className={styles.dot}></span>
                  <span className={styles.dot}></span>
                </button>
              </Link>
            );
          })}
      </div>

      {openMenuRoom && (
        <FloatingPortal>
          <div
            ref={menuRefs.setFloating}
            style={menuFloatingStyles}
            className={styles.actionMenu}
            role="menu"
            data-open={isMenuVisible ? "1" : "0"}
          >
            <button
              type="button"
              className={styles.menuItem}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpenMenuRoomId(null);
                // TODO: 通知オフ機能
              }}
            >
              通知OFF
              <IoIosNotificationsOff className={styles.menuIcon} />
            </button>
            <button
              type="button"
              className={styles.menuItem}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setHideModalRoomId(openMenuRoom.id);
                setHideModalOpponent(
                  openMenuRoom.opponent ?? openMenuRoom.members[0]?.user,
                );
              }}
            >
              非表示
              <IoIosEyeOff className={styles.menuIcon} />
            </button>
            <button
              type="button"
              className={cn(styles.menuItem, styles.dangerAction)}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDeleteModalRoomId(openMenuRoom.id);
                setDeleteModalOpponent(
                  openMenuRoom.opponent ?? openMenuRoom.members[0]?.user,
                );
              }}
            >
              削除
              <TiDeleteOutline className={styles.menuIcon} />
            </button>
          </div>
        </FloatingPortal>
      )}

      {/* 非表示確認モーダル */}
      <UserConfirmModal
        open={hideModalRoomId !== null}
        onOpenChange={(open) => {
          if (!open && hideProcessing) return;
          if (!open) setHideModalRoomId(null);
        }}
        title="チャットを非表示にしますか？"
        description="チャット一覧からこのルームを非表示にします。チャット履歴は削除されません。"
        bodyText="検索すると再度チャットできます。チャット履歴は削除されません。"
        userName={hideModalOpponent?.name || ""}
        userImage={hideModalOpponent?.image || null}
        confirmLabel="非表示にする"
        cancelLabel="キャンセル"
        variant="block"
        processing={hideProcessing}
        onConfirm={handleConfirmHide}
      />

      {/* 削除確認モーダル */}
      <UserConfirmModal
        open={deleteModalRoomId !== null}
        onOpenChange={(open) => {
          if (!open && deleteProcessing) return;
          if (!open) setDeleteModalRoomId(null);
        }}
        title="チャットルームを削除しますか？"
        description="この操作は取り消せません。ルームとメッセージは完全に削除されます。"
        bodyText=""
        userName={deleteModalOpponent?.name || ""}
        userImage={deleteModalOpponent?.image || null}
        confirmLabel="削除する"
        cancelLabel="キャンセル"
        variant="block"
        processing={deleteProcessing}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
