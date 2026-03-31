"use client";

import ChatEditor from "@/app/(sidebar)/components/ChatEditor";
import { ChatOrderModal } from "@/app/(sidebar)/components/ChatOrderModal";
import { ChatScoutModal } from "@/app/(sidebar)/components/ChatScoutModal";
import QuickReactions from "@/app/(sidebar)/components/QuickReactions";
import { WcoinTipModal } from "@/app/(sidebar)/components/WcoinTipModal";
import {
  createChatMessageSchema,
  MESSAGE_CONSTRAINTS,
} from "@/app/schemas/chat";
import Avatar from "@/components/Avatar";
import type { User } from "@/generated/prisma/client";
import { cn } from "@/lib/cn";
import { formatTimeAgo } from "@/utils/date";
import { fetcher } from "@/utils/fetcher";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { FiDownload } from "react-icons/fi";
import { LuClipboardList } from "react-icons/lu";
import { MdOutlineDeleteOutline } from "react-icons/md";
import { RiSpeakFill } from "react-icons/ri";
import { RxEnterFullScreen } from "react-icons/rx";
import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";
import ReactionBar from "../../components/ReactionBar";
import styles from "./ChatArea.module.scss";
import { DeleteChatMessageModal } from "./DeleteChatMessageModal";
import MessageContent from "./MessageContent";

type ChatMessage = {
  id: number;
  publicId: string;
  content: string | null;
  createdAt: string;
  user: {
    id: number;
    name: string;
    image: string | null;
    publicId: string;
  };
  reactions: {
    emoji: string;
    firstReactedAt: string;
    count: number;
    userReacted: boolean;
  }[];
  attachments: {
    id: number;
    url: string;
    type: string;
    name: string | null;
  }[];
  isOwn: boolean;
  isRead?: boolean;
  readBy?: number;
  order?: {
    id: number;
    publicId: string;
    title: string;
    description: string;
    price: number | null;
    priceUnit?: "YEN" | "W" | "BOTH";
    deadline: string | null;
    status: "PENDING" | "APPROVED" | "REJECTED";
    requesterUserId: number;
    targetUserId: number;
  } | null;
};

type ChatRoom = {
  id: number;
  publicId: string;
  opponent?: {
    id: number;
    name: string;
    image: string | null;
    publicId: string;
  } | null;
};

type ScoutProjectForModal = {
  publicId: string;
  name: string;
  memberCount: number;
  maxMembers: number;
  availableRoles: { id: number; name: string }[];
};

type Props = {
  roomPublicId: string;
  userEmojiStats?: string[];
  opponentUserId?: number;
  opponentPrivacyActions?: {
    follow: boolean;
    order: boolean;
    scout: boolean;
    tip: boolean;
  };
  currUser: Pick<User, "id" | "publicId">;
  // サーバ側で判定したブロック状態
  isBlocked?: boolean; // 自分が相手をブロックしている
  isBlockedBy?: boolean; // 相手が自分をブロックしている
  initialScoutProjects?: ScoutProjectForModal[];
  initialRoom?: ChatRoom;
  initialMessages?: ChatMessage[];
};

type ScoutCardInfo = {
  projectName: string;
  roleNames?: string[];
  message?: string;
  joinRequestId?: number;
  status?: "PENDING" | "APPROVED" | "DECLINED";
  updatedAtMs?: number;
};

type ChatEditorHandle = {
  getHTML: () => string;
  getText: () => string;
  clearContent: () => void;
  focus: () => void;
  setContent: (content: string) => void;
};

/**
 * メッセージの日付を「今日」「昨日」「N日前」などのラベルに変換する
 */
function formatDateLabel(dateStr: string): string {
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return "";

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetStart = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );

  const diffMs = todayStart.getTime() - targetStart.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "今日";
  if (diffDays === 1) return "昨日";
  if (diffDays < 7) return `${diffDays}日前`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}週間前`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}か月前`;

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}年前`;
}

/**
 * YYYY-MM-DD 形式の日付キーを返す（グループ化用）
 */
function toDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 日付文字列を「YYYY年MM月DD日」の形式に整形する
 */
function formatFullDateJa(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}年${month}月${day}日`;
}

// --- Helper: HTML を解析して "絵文字のみ（3個以下）" を判定 ---
function isEmojiOnlySmallFromHtml(html: string): boolean {
  if (!html.trim()) return false;
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

    return !hasNonEmoji && foundEmojiCount > 0 && foundEmojiCount <= 3;
  } catch {
    return false;
  }
}

// --- Helper: HTML に視覚的なコンテンツ（絵文字またはテキスト）があるか ---
function hasVisibleContentFromHtml(html: string): boolean {
  if (!html) return false;
  try {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;

    if (wrapper.querySelector('[data-type="emoji"]')) return true;

    const text = (wrapper.textContent || "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > 0;
  } catch {
    return false;
  }
}

// --- Helper: スカウトメッセージ（data-bewts-scout="1"）を解析してカード情報に変換 ---
function parseScoutMessageFromHtml(html: string | null): ScoutCardInfo | null {
  if (!html) return null;

  try {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;

    const scoutHeader = wrapper.querySelector('[data-bewts-scout="1"]');
    const isLegacyScoutLike = (() => {
      const ps = Array.from(wrapper.querySelectorAll("p"));
      if (ps.length === 0) return false;
      const hasScoutTitle = ps.some((p) =>
        (p.textContent || "").trim().includes("スカウト"),
      );
      const hasProjectLine = ps.some((p) =>
        (p.textContent || "").trim().includes("プロジェクト："),
      );
      return hasScoutTitle && hasProjectLine;
    })();

    if (!scoutHeader && !isLegacyScoutLike) return null;

    const ps = Array.from(wrapper.querySelectorAll("p"));

    let projectName: string | undefined;
    let roleNames: string[] | undefined;
    let message: string | undefined;
    let joinRequestId: number | undefined;
    let status: ScoutCardInfo["status"] | undefined;
    let updatedAtMs: number | undefined;

    if (scoutHeader) {
      const joinRequestIdAttr = scoutHeader.getAttribute(
        "data-bewts-joinrequest-id",
      );
      if (joinRequestIdAttr) {
        const parsed = Number(joinRequestIdAttr);
        if (!Number.isNaN(parsed)) {
          joinRequestId = parsed;
        }
      }

      const statusAttr = scoutHeader.getAttribute("data-bewts-scout-status");
      if (
        statusAttr === "PENDING" ||
        statusAttr === "APPROVED" ||
        statusAttr === "DECLINED"
      ) {
        status = statusAttr;
      }

      const updatedAttr = scoutHeader.getAttribute(
        "data-bewts-scout-updated-at",
      );
      if (updatedAttr) {
        const t = Date.parse(updatedAttr);
        if (!Number.isNaN(t)) {
          updatedAtMs = t;
        }
      }
    }

    ps.forEach((p, index) => {
      const text = (p.textContent || "").trim();
      if (!text) return;

      if (!projectName && text.includes("プロジェクト：")) {
        projectName = text.split("プロジェクト：").pop()?.trim();
        return;
      }

      if (!roleNames && text.includes("役割：")) {
        const raw = text.split("役割：").pop()?.trim() ?? "";
        const parsed = raw
          .split("/")
          .map((v) => v.trim())
          .filter(Boolean);
        roleNames = parsed.length > 0 ? parsed : undefined;
        return;
      }

      if (!message && text === "メッセージ：") {
        const next = ps[index + 1];
        if (next) {
          const html = next.innerHTML || "";
          const normalized = html
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/&nbsp;/g, " ");
          message = normalized.trim();
        }
      }
    });

    if (!projectName) {
      projectName = "ビューズプロジェクト";
    }

    return {
      projectName,
      roleNames,
      message,
      joinRequestId,
      status,
      updatedAtMs,
    };
  } catch {
    return null;
  }
}

// --- Helper: MessageContent を表示すべきか ---
function shouldRenderMessageContent(msg: ChatMessage): boolean {
  const hasVisibleContent = hasVisibleContentFromHtml(msg.content || "");
  const hasAttachments = (msg.attachments || []).length > 0;

  // スカウトメッセージは専用カードで表示するので本文レンダリングは抑制
  if (parseScoutMessageFromHtml(msg.content || "")) return false;

  // テキストがなく添付ファイルのみの場合は MessageContent を表示しない
  if (!hasVisibleContent && hasAttachments) return false;

  // オーダーメッセージは専用カードで表示するので本文レンダリングは抑制
  if (msg.order) return false;

  return true;
}

// --- Helper: 添付ファイル用の簡易アイコンを返す ---
function getFileIcon(type: string, name?: string | null): string {
  if (type === "application/pdf") return "P";
  if (type.startsWith("text/")) return "T";
  if (type.startsWith("application/")) {
    if (type.includes("word") || type.includes("document")) return "W";
    if (type.includes("excel") || type.includes("spreadsheet")) return "X";
    if (type.includes("powerpoint") || type.includes("presentation"))
      return "S";
    if (type.includes("zip") || type.includes("compressed")) return "Z";
  }
  if (name) {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "txt") return "T";
    if (ext === "pdf") return "P";
    if (ext === "doc" || ext === "docx") return "W";
    if (ext === "xls" || ext === "xlsx") return "X";
    if (ext === "ppt" || ext === "pptx") return "S";
    if (ext === "zip" || ext === "rar" || ext === "7z") return "Z";
  }
  return "F";
}

function formatOrderPrice(
  price: number,
  priceUnit: "YEN" | "W" | "BOTH" | undefined,
): string {
  const unit = priceUnit ?? "BOTH";
  const formatted = price.toLocaleString();
  if (unit === "YEN") return `${formatted}円`;
  if (unit === "BOTH") return `${formatted}円 / ${formatted} W`;
  return `${formatted} W`;
}

export default function ChatArea({
  roomPublicId,
  userEmojiStats = [],
  opponentUserId,
  opponentPrivacyActions,
  currUser,
  isBlocked = false,
  isBlockedBy = false,
  initialScoutProjects,
  initialRoom,
  initialMessages,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scrollScoutRequestId = searchParams.get("scoutRequestId");
  const focusReaction = searchParams.get("focusReaction") === "1";
  const targetMessagePublicId = searchParams.get("messagePublicId");
  const [nowTs, setNowTs] = useState<number>(Date.now());
  const hasInitialRoom = initialRoom !== undefined;
  const hasInitialMessages = initialMessages !== undefined;
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages ?? [],
  );
  const [room, setRoom] = useState<ChatRoom | null>(initialRoom ?? null);
  const [isRoomLoading, setIsRoomLoading] = useState(!hasInitialRoom);
  const [isMessagesInitialLoading, setIsMessagesInitialLoading] = useState(
    !hasInitialMessages,
  );
  const [attachments, setAttachments] = useState<
    {
      id: number | string;
      url: string;
      type: string;
      name?: string | null;
      file?: File;
    }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<number | null>(null);
  const [isMentionPreviewVisible, setIsMentionPreviewVisible] = useState(false);
  const [emojiPickerOpenMessageId, setEmojiPickerOpenMessageId] = useState<
    number | null
  >(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const editorRef = useRef<ChatEditorHandle | null>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [orderActionProcessingId, setOrderActionProcessingId] = useState<
    string | null
  >(null);
  const [scoutActionProcessingId, setScoutActionProcessingId] = useState<
    number | null
  >(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [scoutOpen, setScoutOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<{
    id: number;
    publicId: string;
  } | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null,
  );
  const headerNameRef = useRef<HTMLSpanElement | null>(null);
  const [headerNameOverflow, setHeaderNameOverflow] = useState(0);

  const currentUserIdNum = Number(currUser.id);
  const currentUserPublicId = currUser.publicId;

  useEffect(() => {
    const measure = () => {
      const el = headerNameRef.current;
      if (!el) return;
      setHeaderNameOverflow(Math.max(el.scrollWidth - el.clientWidth, 0));
    };

    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
    };
  }, []);

  // 1分間の承諾取消ウィンドウをクライアント側でも判定するための現在時刻タイマー
  useEffect(() => {
    const id = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000 * 5);
    return () => window.clearInterval(id);
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const data = await fetcher<ChatMessage[]>(
        `/api/chat/rooms/${roomPublicId}/messages`,
      );
      if (Array.isArray(data)) {
        setMessages(data);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("chat:rooms-updated"));
        }
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView();
        }, 100);
      }
    } catch (e) {
      console.error("Failed to load messages", e);
    } finally {
      setIsMessagesInitialLoading(false);
    }
  }, [roomPublicId]);

  const handleDeleteMessage = useCallback(
    async (messagePublicId: string) => {
      try {
        await fetcher(
          `/api/chat/rooms/${roomPublicId}/messages/${messagePublicId}`,
          {
            method: "DELETE",
          },
        );
        await loadMessages();
      } catch (error) {
        console.error("Failed to delete message", error);
        throw error;
      }
    },
    [roomPublicId, loadMessages],
  );

  // 外部から "履歴クリア" を反映させるためのイベントリスナー
  useEffect(() => {
    const handler = () => {
      loadMessages();
    };
    window.addEventListener("chat:messages-cleared", handler);
    return () => window.removeEventListener("chat:messages-cleared", handler);
  }, [loadMessages]);

  type ServerRoom = ChatRoom & {
    members?: {
      userId?: number;
      isHidden?: boolean;
      deletedAt?: string | null;
      user: { publicId: string };
    }[];
  };

  const loadRoom = useCallback(async () => {
    try {
      const data = await fetcher<ServerRoom>(`/api/chat/rooms/${roomPublicId}`);
      setRoom(data);

      // サーバー側で当該ルームが isHidden のままになっている可能性があるので
      // クライアント側で検出したら明示的に非表示解除して ChatList を更新する
      const myMember = data.members?.find(
        (m) =>
          m.userId === currentUserIdNum ||
          m.user.publicId === currentUserPublicId,
      );

      if (myMember?.isHidden) {
        try {
          await fetcher(`/api/chat/rooms/${roomPublicId}/visibility`, {
            method: "POST",
            body: JSON.stringify({ isHidden: false }),
          });
          // ChatList に反映してもらうためのイベント発行
          window.dispatchEvent(new Event("chat:rooms-updated"));
        } catch {
          // noop
        }
      }
    } catch (e) {
      console.error("Failed to load room", e);
    } finally {
      setIsRoomLoading(false);
    }
  }, [roomPublicId, currentUserIdNum, currentUserPublicId]);

  const handleSend = useCallback(async () => {
    if (isLoading) return;

    const content = editorRef.current?.getHTML() ?? "";
    const textContent = editorRef.current?.getText() ?? "";

    setError(null);

    if (textContent.length > MESSAGE_CONSTRAINTS.MAX_CONTENT_LENGTH) {
      setError(
        `メッセージは${MESSAGE_CONSTRAINTS.MAX_CONTENT_LENGTH}文字以内にしてください`,
      );
      return;
    }

    if (attachments.length > MESSAGE_CONSTRAINTS.MAX_ATTACHMENTS) {
      setError(
        `添付ファイルは${MESSAGE_CONSTRAINTS.MAX_ATTACHMENTS}個までです`,
      );
      return;
    }

    setIsLoading(true);

    try {
      const uploadedAttachments = [];

      // ChatArea.tsx の handleSend 内
      for (const att of attachments) {
        if (att.file) {
          const formData = new FormData();
          formData.append("file", att.file);
          const data = await fetcher<{
            url: string;
            type: string;
            name: string;
          }>("/api/chat/upload", {
            method: "POST",
            body: formData,
          });
          uploadedAttachments.push({
            url: data.url,
            type: att.type, // ← Cloudinaryの "raw"/"image" ではなく元のMIMEタイプを使う
            name: data.name ?? att.name ?? "",
          });
        } else {
          uploadedAttachments.push({
            url: att.url,
            type: att.type,
            name: att.name ?? "",
          });
        }
      }

      const messageData = {
        content:
          !textContent.trim() && uploadedAttachments.length > 0
            ? null
            : content,
        attachments: uploadedAttachments,
      };

      const validationResult = createChatMessageSchema.safeParse(messageData);

      if (!validationResult.success) {
        const firstError = validationResult.error.issues[0];
        setError(firstError.message);
        return;
      }

      if (editingMessage) {
        await fetcher(
          `/api/chat/rooms/${roomPublicId}/messages/${editingMessage.publicId}`,
          {
            method: "PATCH",
            body: JSON.stringify(validationResult.data),
          },
        );
      } else {
        await fetcher(`/api/chat/rooms/${roomPublicId}/messages`, {
          method: "POST",
          body: JSON.stringify(validationResult.data),
        });
      }

      editorRef.current?.clearContent();
      setAttachments([]);
      setError(null);
      setEditingMessage(null);
      await loadMessages();
    } catch (e) {
      console.error("Send failed", e);
      if (e instanceof Error) {
        setError(e.message || "送信に失敗しました");
      } else {
        setError("送信に失敗しました");
      }
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, attachments, roomPublicId, loadMessages, editingMessage]);

  useEffect(() => {
    if (!hasInitialMessages) {
      loadMessages();
    }
    if (!hasInitialRoom) {
      loadRoom();
    }
  }, [loadMessages, loadRoom, hasInitialMessages, hasInitialRoom]);

  // メッセージを日付ごとにグループ化
  const groupedMessages = messages.reduce(
    (groups, msg) => {
      const key = toDateKey(msg.createdAt);
      if (!groups[key]) {
        groups[key] = { label: formatDateLabel(msg.createdAt), messages: [] };
      }
      groups[key].messages.push(msg);
      return groups;
    },
    {} as Record<string, { label: string; messages: ChatMessage[] }>,
  );

  const dateGroups = Object.entries(groupedMessages);

  const shouldShowSkeleton = isMessagesInitialLoading && messages.length === 0;

  const isChatDisabled = isBlocked || isBlockedBy;
  let blockMessage: string | null = null;

  if (isBlocked) {
    blockMessage = "チャットするには設定からブロックを解除する必要があります";
  } else if (isBlockedBy) {
    blockMessage = "現在このユーザとのチャットはできません";
  }
  const editorPlaceholder =
    isChatDisabled && blockMessage
      ? blockMessage
      : editingMessage
        ? "メッセージを編集..."
        : "メッセージを入力...";

  // 通知から "?scoutRequestId=..." 付きで遷移してきた場合、そのスカウトメッセージまでスク役割
  useEffect(() => {
    if (!scrollScoutRequestId) return;
    if (messages.length === 0) return;

    const target = messages.find((m) => {
      const info = parseScoutMessageFromHtml(m.content || "");
      return info?.joinRequestId === Number(scrollScoutRequestId);
    });

    if (target && messageRefs.current[target.id]) {
      messageRefs.current[target.id]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [messages, scrollScoutRequestId]);

  // 通知の「いいねで反応」から遷移時: 対象メッセージへスク役割し、👍を付与
  useEffect(() => {
    if (!focusReaction || !targetMessagePublicId) return;
    if (messages.length === 0) return;

    const target = messages.find((m) => m.publicId === targetMessagePublicId);
    if (!target) return;

    messageRefs.current[target.id]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    const alreadyReacted = target.reactions.some(
      (reaction) => reaction.emoji === "👍" && reaction.userReacted,
    );
    if (alreadyReacted) return;

    let canceled = false;

    const react = async () => {
      try {
        await fetcher(
          `/api/chat/rooms/${roomPublicId}/messages/${target.publicId}/reactions`,
          {
            method: "POST",
            body: JSON.stringify({ emoji: "👍" }),
          },
        );

        if (!canceled) {
          await loadMessages();
        }
      } catch (error) {
        console.error("通知経由リアクション失敗:", error);
      }
    };

    void react();

    return () => {
      canceled = true;
    };
  }, [
    focusReaction,
    targetMessagePublicId,
    messages,
    roomPublicId,
    loadMessages,
  ]);

  return (
    <div className={styles.chatArea}>
      <div className={styles.header}>
        {isRoomLoading ? (
          <div className={styles.headerTitle} style={{ cursor: "default" }}>
            <span className={styles.headerTitleSkeleton} aria-hidden="true" />
          </div>
        ) : (
          <button
            type="button"
            className={styles.headerTitle}
            onClick={() => {
              if (!room?.opponent?.publicId) return;
              router.push(`/users/${room.opponent.publicId}`);
            }}
          >
            {room?.opponent?.name ? (
              <>
                <span
                  ref={headerNameRef}
                  className={cn(
                    styles.headerTitleName,
                    headerNameOverflow > 0 && styles.marqueeReady,
                  )}
                  style={
                    {
                      "--marquee-distance": `${headerNameOverflow}px`,
                    } as CSSProperties
                  }
                >
                  <span className={styles.marqueeText}>
                    {room.opponent.name}
                  </span>
                </span>
                <span className={styles.headerTitleHonorific}>さん</span>
              </>
            ) : (
              "チャット"
            )}
          </button>
        )}
      </div>

      <div className={styles.messagesCont}>
        <div className={styles.messages}>
          <div
            className={cn(
              styles.messagesSkeleton,
              shouldShowSkeleton
                ? styles.messagesSkeletonVisible
                : styles.messagesSkeletonHidden,
            )}
            aria-hidden={!isMessagesInitialLoading || messages.length > 0}
          >
            {[180, 150, 200, 170, 160].map((width, i) => (
              <div
                // biome-ignore lint: indexは変化しないためキーとして妥当
                key={i}
                className={cn(
                  styles.messageSkeletonRow,
                  i % 2 === 0
                    ? styles.messageSkeletonRowLeft
                    : styles.messageSkeletonRowRight,
                )}
              >
                <div className={styles.messageSkeletonBubble}>
                  <div
                    className={styles.messageSkeletonContent}
                    style={{ width }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div
            className={cn(
              styles.messagesContentFade,
              !isMessagesInitialLoading || messages.length > 0
                ? styles.messagesContentVisible
                : styles.messagesContentHidden,
            )}
          >
            {dateGroups.map(([dateKey, group]) => (
              <div key={dateKey} className={styles.dateGroup}>
                {/* Sticky日付ラベル */}
                <div className={styles.dateLabelWrapper}>
                  <span className={styles.dateLabel}>{group.label}</span>
                </div>

                {group.messages.map((msg) => {
                  const reactionCounts = msg.reactions;
                  const userReactedEmojis = msg.reactions
                    .filter((r) => r.userReacted)
                    .map((r) => r.emoji);

                  // --- 判定: emoji-only (絵文字のみかつ3個以下) ---
                  const isEmojiOnlySmall = isEmojiOnlySmallFromHtml(
                    msg.content || "",
                  );

                  const scout = parseScoutMessageFromHtml(msg.content || "");

                  const order = msg.order;
                  const isOrderReceiver =
                    order && order.targetUserId === currentUserIdNum;
                  const canDecideOrder =
                    !!order && order.status === "PENDING" && isOrderReceiver;
                  // オーダーメッセージは専用カードで描画するが、
                  // 既読・時間の位置は通常メッセージと同じレイアウトに揃える
                  if (order) {
                    const isOwn = msg.isOwn;

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          styles.orderMessageRow,
                          isOwn
                            ? styles.orderMessageOwn
                            : styles.orderMessageOther,
                          isOwn && styles.own,
                        )}
                      >
                        {!isOwn && (
                          <Avatar
                            src={msg.user.image}
                            alt={msg.user.name}
                            className={styles.messageAvatar}
                          />
                        )}
                        <div className={styles.orderMessageMain}>
                          {!isOwn && (
                            <span className={styles.senderName}>
                              {msg.user.name}
                            </span>
                          )}
                          <div className={styles.messageAndTime}>
                            <div className={styles.time}>
                              {isOwn && msg.isRead && (
                                <div className={styles.readStatus}>既読</div>
                              )}
                              {formatTimeAgo(msg.createdAt)}
                            </div>
                            <div
                              className={cn(
                                styles.orderCard,
                                isOwn
                                  ? styles.orderCardOwn
                                  : styles.orderCardOther,
                              )}
                            >
                              <div className={styles.orderHeaderRow}>
                                <div className={styles.orderTitle}>
                                  オーダー
                                </div>
                                <span
                                  className={cn(
                                    styles.orderBadge,
                                    order.status === "APPROVED" &&
                                      styles.orderBadgeApproved,
                                    order.status === "REJECTED"
                                      ? styles.orderBadgeRejected
                                      : styles.orderBadgePending,
                                  )}
                                >
                                  {order.status === "PENDING"
                                    ? "承認待ち"
                                    : order.status === "APPROVED"
                                      ? "承認済み"
                                      : "拒否されました"}
                                </span>
                              </div>
                              <div className={styles.orderSection}>
                                <div className={styles.orderValue}>
                                  {order.title}
                                </div>
                              </div>
                              <div className={styles.orderDescription}>
                                {order.description}
                              </div>
                              <div className={styles.orderMetaRow}>
                                {order.price != null && (
                                  <span>
                                    <span className={styles.orderMetaLabel}>
                                      希望金額（任意）
                                    </span>{" "}
                                    {formatOrderPrice(
                                      order.price,
                                      order.priceUnit,
                                    )}
                                  </span>
                                )}
                                {order.deadline && (
                                  <span>
                                    <span className={styles.orderMetaLabel}>
                                      希望納期（任意）
                                    </span>{" "}
                                    {formatFullDateJa(order.deadline)}
                                  </span>
                                )}
                              </div>
                              {canDecideOrder && (
                                <div className={styles.orderActions}>
                                  <button
                                    type="button"
                                    className={cn(
                                      styles.orderActionBtn,
                                      styles.orderActionReject,
                                    )}
                                    disabled={
                                      orderActionProcessingId === order.publicId
                                    }
                                    onClick={async () => {
                                      try {
                                        setOrderActionProcessingId(
                                          order.publicId,
                                        );
                                        await fetcher(
                                          `/api/chat/orders/${order.publicId}`,
                                          {
                                            method: "PATCH",
                                            body: JSON.stringify({
                                              status: "REJECTED",
                                            }),
                                          },
                                        );
                                        await loadMessages();
                                      } finally {
                                        setOrderActionProcessingId(null);
                                      }
                                    }}
                                  >
                                    拒否
                                  </button>
                                  <button
                                    type="button"
                                    className={cn(
                                      styles.orderActionBtn,
                                      styles.orderActionApprove,
                                    )}
                                    disabled={
                                      orderActionProcessingId === order.publicId
                                    }
                                    onClick={async () => {
                                      try {
                                        setOrderActionProcessingId(
                                          order.publicId,
                                        );
                                        await fetcher(
                                          `/api/chat/orders/${order.publicId}`,
                                          {
                                            method: "PATCH",
                                            body: JSON.stringify({
                                              status: "APPROVED",
                                            }),
                                          },
                                        );
                                        await loadMessages();
                                      } finally {
                                        setOrderActionProcessingId(null);
                                      }
                                    }}
                                  >
                                    承認
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // スカウトメッセージも専用カードで描画
                  if (scout) {
                    const isOwn = msg.isOwn;
                    const status = scout.status ?? "PENDING";

                    const updatedBase =
                      scout.updatedAtMs ?? new Date(msg.createdAt).getTime();
                    const withinUndoWindow =
                      status === "APPROVED" && nowTs - updatedBase <= 60 * 1000;

                    const showPendingActions =
                      !isOwn &&
                      status === "PENDING" &&
                      typeof scout.joinRequestId === "number";

                    const showApprovedActions =
                      !isOwn &&
                      status === "APPROVED" &&
                      withinUndoWindow &&
                      typeof scout.joinRequestId === "number";

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          styles.orderMessageRow,
                          isOwn
                            ? styles.orderMessageOwn
                            : styles.orderMessageOther,
                          isOwn && styles.own,
                        )}
                      >
                        {!isOwn && (
                          <Avatar
                            src={msg.user.image}
                            alt={msg.user.name}
                            className={styles.messageAvatar}
                          />
                        )}
                        <div className={styles.orderMessageMain}>
                          {!isOwn && (
                            <span className={styles.senderName}>
                              {msg.user.name}
                            </span>
                          )}
                          <div className={styles.messageAndTime}>
                            <div className={styles.time}>
                              {isOwn && msg.isRead && (
                                <div className={styles.readStatus}>既読</div>
                              )}
                              {formatTimeAgo(msg.createdAt)}
                            </div>
                            <div
                              className={cn(
                                styles.orderCard,
                                isOwn
                                  ? styles.orderCardOwn
                                  : styles.orderCardOther,
                              )}
                            >
                              <div className={styles.orderHeaderRow}>
                                <div className={styles.orderTitle}>
                                  スカウト
                                </div>
                                <span
                                  className={cn(
                                    styles.orderBadge,
                                    status === "APPROVED" &&
                                      styles.orderBadgeApproved,
                                    status === "DECLINED"
                                      ? styles.orderBadgeRejected
                                      : styles.orderBadgePending,
                                  )}
                                >
                                  {status === "PENDING"
                                    ? "承諾待ち"
                                    : status === "APPROVED"
                                      ? "承諾済み"
                                      : "辞退済み"}
                                </span>
                              </div>
                              <div className={styles.orderSection}>
                                <div className={styles.orderValue}>
                                  プロジェクト：{scout.projectName}
                                </div>
                              </div>
                              {scout.roleNames &&
                                scout.roleNames.length > 0 && (
                                  <div className={styles.orderMetaRow}>
                                    <span>
                                      <span className={styles.orderMetaLabel}>
                                        役割
                                      </span>{" "}
                                      {scout.roleNames.join(" / ")}
                                    </span>
                                  </div>
                                )}
                              {scout.message && (
                                <div className={styles.orderDescription}>
                                  {scout.message}
                                </div>
                              )}
                              {showPendingActions && scout.joinRequestId && (
                                <div className={styles.orderActions}>
                                  <button
                                    type="button"
                                    className={cn(
                                      styles.orderActionBtn,
                                      styles.orderActionReject,
                                    )}
                                    disabled={
                                      scoutActionProcessingId ===
                                      scout.joinRequestId
                                    }
                                    onClick={async () => {
                                      try {
                                        setScoutActionProcessingId(
                                          scout.joinRequestId ?? null,
                                        );
                                        await fetcher(
                                          `/api/bewts/scout/${scout.joinRequestId}`,
                                          {
                                            method: "PATCH",
                                            body: JSON.stringify({
                                              action: "reject",
                                              chatMessagePublicId: msg.publicId,
                                            }),
                                          },
                                        );
                                        await loadMessages();
                                      } finally {
                                        setScoutActionProcessingId(null);
                                      }
                                    }}
                                  >
                                    拒否
                                  </button>
                                  <button
                                    type="button"
                                    className={cn(
                                      styles.orderActionBtn,
                                      styles.orderActionApprove,
                                    )}
                                    disabled={
                                      scoutActionProcessingId ===
                                      scout.joinRequestId
                                    }
                                    onClick={async () => {
                                      try {
                                        setScoutActionProcessingId(
                                          scout.joinRequestId ?? null,
                                        );
                                        await fetcher(
                                          `/api/bewts/scout/${scout.joinRequestId}`,
                                          {
                                            method: "PATCH",
                                            body: JSON.stringify({
                                              action: "accept",
                                              chatMessagePublicId: msg.publicId,
                                            }),
                                          },
                                        );
                                        await loadMessages();
                                      } finally {
                                        setScoutActionProcessingId(null);
                                      }
                                    }}
                                  >
                                    承諾
                                  </button>
                                </div>
                              )}
                              {showApprovedActions && scout.joinRequestId && (
                                <div className={styles.orderActions}>
                                  <button
                                    type="button"
                                    className={cn(
                                      styles.orderActionBtn,
                                      styles.orderActionReject,
                                    )}
                                    disabled={
                                      scoutActionProcessingId ===
                                      scout.joinRequestId
                                    }
                                    onClick={async () => {
                                      try {
                                        setScoutActionProcessingId(
                                          scout.joinRequestId ?? null,
                                        );
                                        await fetcher(
                                          `/api/bewts/scout/${scout.joinRequestId}`,
                                          {
                                            method: "PATCH",
                                            body: JSON.stringify({
                                              action: "reject",
                                              chatMessagePublicId: msg.publicId,
                                            }),
                                          },
                                        );
                                        await loadMessages();
                                      } finally {
                                        setScoutActionProcessingId(null);
                                      }
                                    }}
                                  >
                                    拒否
                                  </button>
                                  <button
                                    type="button"
                                    className={cn(
                                      styles.orderActionBtn,
                                      styles.orderActionApprove,
                                    )}
                                    disabled={
                                      scoutActionProcessingId ===
                                      scout.joinRequestId
                                    }
                                    onClick={async () => {
                                      try {
                                        setScoutActionProcessingId(
                                          scout.joinRequestId ?? null,
                                        );
                                        await fetcher(
                                          `/api/bewts/scout/${scout.joinRequestId}`,
                                          {
                                            method: "PATCH",
                                            body: JSON.stringify({
                                              action: "undoAccept",
                                              chatMessagePublicId: msg.publicId,
                                            }),
                                          },
                                        );
                                        await loadMessages();
                                      } finally {
                                        setScoutActionProcessingId(null);
                                      }
                                    }}
                                  >
                                    承諾取消
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={cn(styles.messageRow, msg.isOwn && styles.own)}
                    >
                      {/* 相手メッセージ: アバター＋名前を上に表示 */}
                      {!msg.isOwn && (
                        <Avatar
                          src={msg.user.image}
                          alt={msg.user.name}
                          className={styles.messageAvatar}
                        />
                      )}
                      <div className={styles.messageRightSide}>
                        {!msg.isOwn && (
                          <span className={styles.senderName}>
                            {msg.user.name}
                          </span>
                        )}

                        <div className={styles.messageAndTime}>
                          <div className={styles.time}>
                            {msg.isOwn && msg.isRead && (
                              <div className={styles.readStatus}>既読</div>
                            )}
                            {formatTimeAgo(msg.createdAt)}
                          </div>
                          {/* biome-ignore lint: メッセージにdivを使用 */}
                          <div
                            ref={(el) => {
                              messageRefs.current[msg.id] = el;
                            }}
                            className={cn(
                              styles.messageWrapper,
                              isEmojiOnlySmall && styles.emojiOnly,
                              editingMessage &&
                                editingMessage.id === msg.id &&
                                styles.editingTarget,
                            )}
                            onMouseEnter={() => setHoveredMessageId(msg.id)}
                            onMouseLeave={() => setHoveredMessageId(null)}
                          >
                            <QuickReactions
                              anchorRef={{
                                current: messageRefs.current[msg.id] ?? null,
                              }}
                              show={
                                hoveredMessageId === msg.id &&
                                !isMentionPreviewVisible &&
                                (emojiPickerOpenMessageId === null ||
                                  emojiPickerOpenMessageId === msg.id)
                              }
                              endpoint={`/api/chat/rooms/${room?.publicId}/messages/${msg.publicId}/reactions`}
                              initialUserEmojiStats={userEmojiStats}
                              classNames={{
                                quickReactions: styles.quickReactions,
                                emojiPicker: styles.emojiPicker,
                              }}
                              additionalButtons={
                                msg.isOwn
                                  ? [
                                      {
                                        icon: (
                                          <Image
                                            src="/images/edit.png"
                                            alt="メッセージを編集"
                                            width={18}
                                            height={18}
                                          />
                                        ),
                                        onClick: () => {
                                          setEditingMessage(msg);
                                          editorRef.current?.setContent(
                                            msg.content || "",
                                          );
                                          editorRef.current?.focus();
                                          setAttachments(
                                            (msg.attachments || []).map(
                                              (att) => ({
                                                id: att.id,
                                                url: att.url,
                                                type: att.type,
                                                name: att.name,
                                              }),
                                            ),
                                          );
                                        },
                                        label: "メッセージを編集",
                                      },
                                      {
                                        icon: <MdOutlineDeleteOutline />,
                                        onClick: () => {
                                          setMessageToDelete({
                                            id: msg.id,
                                            publicId: msg.publicId,
                                          });
                                          setDeleteModalOpen(true);
                                        },
                                        label: "メッセージを削除",
                                      },
                                    ]
                                  : undefined
                              }
                              onEmojiPickerOpen={() =>
                                setEmojiPickerOpenMessageId(msg.id)
                              }
                              onEmojiPickerClose={() =>
                                setEmojiPickerOpenMessageId(null)
                              }
                              onUpdate={(data) => {
                                const mapped = data.reactions.map((r) => ({
                                  emoji: r.emoji,
                                  firstReactedAt: r.firstReactedAt,
                                  count: r.count,
                                  userReacted: !!r.userReacted,
                                }));

                                setMessages((prev) =>
                                  prev.map((m) =>
                                    m.publicId === msg.publicId
                                      ? { ...m, reactions: mapped }
                                      : m,
                                  ),
                                );
                              }}
                            />

                            {/* MessageContent を表示するか判定（写真のみは非表示） */}
                            {shouldRenderMessageContent(msg) ? (
                              <MessageContent
                                content={msg.content || ""}
                                className={styles.messageContent}
                                onMentionPreviewVisibleChange={
                                  setIsMentionPreviewVisible
                                }
                              />
                            ) : null}

                            {/* 画像は PhotoProvider/PhotoView でフルスクリーンかつ同メッセージ内で移動できるようにする */}
                            {msg.attachments.length > 0 && (
                              <div className={styles.attachmentsGrid}>
                                <PhotoProvider>
                                  {msg.attachments.map((att, idx) => {
                                    const urlOrName = (
                                      att.url ||
                                      att.name ||
                                      ""
                                    ).toLowerCase();
                                    const isImage =
                                      att.type.startsWith("image/") ||
                                      /\.(jpe?g|png|gif|webp|avif|bmp|svg|heic|heif)$/i.test(
                                        urlOrName,
                                      );

                                    const handleDownload = async () => {
                                      const res = await fetch(att.url);
                                      const blob = await res.blob();

                                      const a = document.createElement("a");
                                      a.href = URL.createObjectURL(blob);
                                      a.download =
                                        att.name ||
                                        "ダウンロードされたファイル"; // ← 日本語OK
                                      document.body.appendChild(a);
                                      a.click();
                                      a.remove();

                                      URL.revokeObjectURL(a.href);
                                    };

                                    return (
                                      <div
                                        key={`${idx}-${att.name || att.id}`}
                                        className={cn(
                                          styles.attachment,
                                          !isImage &&
                                            styles.attachmentFileWrapper,
                                        )}
                                      >
                                        {isImage ? (
                                          <PhotoView src={att.url} key={att.id}>
                                            <div
                                              className={styles.attachmentThumb}
                                            >
                                              <Image
                                                src={att.url}
                                                alt={att.name || "Image"}
                                                width={1200}
                                                height={800}
                                                className={
                                                  styles.attachmentImage
                                                }
                                                unoptimized
                                              />
                                              <span
                                                className={styles.zoomIcon}
                                                aria-hidden
                                              >
                                                <RxEnterFullScreen />
                                              </span>
                                            </div>
                                          </PhotoView>
                                        ) : (
                                          <div
                                            className={styles.attachmentFile}
                                          >
                                            <div className={styles.fileIcon}>
                                              {getFileIcon(att.type, att.name)}
                                            </div>
                                            <div className={styles.fileInfo}>
                                              <span className={styles.fileName}>
                                                {att.name ||
                                                  att.url.split("/").pop() ||
                                                  "ファイル"}
                                              </span>
                                              <div className={styles.fileExt}>
                                                {att.name
                                                  ?.split(".")
                                                  .pop()
                                                  ?.toUpperCase() || att.type}
                                              </div>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={handleDownload}
                                              className={styles.downloadBtn}
                                            >
                                              <FiDownload />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </PhotoProvider>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className={styles.reactionBarWrapper}>
                          <ReactionBar
                            endpoint={`/api/chat/rooms/${roomPublicId}/messages/${msg.publicId}/reactions`}
                            reactions={reactionCounts}
                            userReactedEmojis={userReactedEmojis}
                            onUpdate={(data) => {
                              const mapped = data.reactions.map((r) => ({
                                emoji: r.emoji,
                                firstReactedAt: r.firstReactedAt,
                                count: r.count,
                                userReacted: !!r.userReacted,
                              }));

                              setMessages((prev) =>
                                prev.map((m) =>
                                  m.publicId === msg.publicId
                                    ? { ...m, reactions: mapped }
                                    : m,
                                ),
                              );
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
      <div
        className={cn(
          styles.chatEditorWrapper,
          isChatDisabled && styles.chatEditorWrapperDisabled,
        )}
      >
        {editingMessage && !isChatDisabled && (
          <div className={styles.editingNotice}>
            <span>メッセージを編集中</span>
            <button
              type="button"
              onClick={() => {
                setEditingMessage(null);
                editorRef.current?.clearContent();
                setAttachments([]);
              }}
            >
              キャンセル
            </button>
          </div>
        )}
        <div className={isChatDisabled ? styles.chatEditorDisabled : undefined}>
          <ChatEditor
            ref={editorRef}
            attachments={attachments}
            setAttachments={setAttachments}
            onSend={handleSend}
            isLoading={isLoading}
            externalError={error}
            privacyActions={opponentPrivacyActions}
            actionMenuButtons={[
              {
                key: "order",
                label: "オーダー",
                icon: <LuClipboardList />,
                disabled: !(opponentPrivacyActions?.order ?? true),
                onClick: () => {
                  if (!opponentPrivacyActions?.order) return;
                  setOrderOpen(true);
                },
              },
              {
                key: "scout",
                label: "スカウト",
                icon: <RiSpeakFill />,
                disabled:
                  !opponentUserId || !(opponentPrivacyActions?.scout ?? true),
                onClick: () => {
                  if (!opponentUserId || !opponentPrivacyActions?.scout) return;
                  setScoutOpen(true);
                },
              },
              {
                key: "tip",
                label: "投げ銭",
                icon: (
                  <Image
                    src="/images/w-coin.png"
                    alt="Wコイン"
                    width={20}
                    height={20}
                  />
                ),
                disabled: !(opponentPrivacyActions?.tip ?? true),
                onClick: () => {
                  if (!opponentPrivacyActions?.tip) return;
                  setTipOpen(true);
                },
              },
            ]}
            placeholder={editorPlaceholder}
            autoFocus={!isChatDisabled}
          />
        </div>
      </div>

      {opponentUserId && (
        <WcoinTipModal
          open={tipOpen}
          onOpenChange={setTipOpen}
          receiverUserId={opponentUserId}
        />
      )}

      {opponentUserId && (
        <ChatScoutModal
          open={scoutOpen}
          onOpenChange={setScoutOpen}
          targetUserId={opponentUserId}
          roomPublicId={roomPublicId}
          initialProjects={initialScoutProjects}
          onSubmitted={async () => {
            await loadMessages();
          }}
        />
      )}

      <ChatOrderModal
        open={orderOpen}
        onOpenChange={setOrderOpen}
        roomPublicId={roomPublicId}
        onSubmitted={async () => {
          await loadMessages();
        }}
      />

      <DeleteChatMessageModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onConfirm={async () => {
          if (messageToDelete) {
            await handleDeleteMessage(messageToDelete.publicId);
            setMessageToDelete(null);
          }
        }}
      />
    </div>
  );
}
