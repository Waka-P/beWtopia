"use client";

import styles from "@/app/(sidebar)/bewts/[publicId]/chat/components/BewtsChatArea.module.scss";
import { DeleteChatMessageModal } from "@/app/(sidebar)/chat/components/DeleteChatMessageModal";
import MessageContent from "@/app/(sidebar)/chat/components/MessageContent";
import ChatEditor from "@/app/(sidebar)/components/ChatEditor";
import HighlightedText from "@/app/(sidebar)/components/HighlightedText";
import QuickReactions from "@/app/(sidebar)/components/QuickReactions";
import ReactionBar, {
  type ReactionCount,
} from "@/app/(sidebar)/components/ReactionBar";
import {
  createChatMessageSchema,
  MESSAGE_CONSTRAINTS,
} from "@/app/schemas/chat";
import Avatar from "@/components/Avatar";
import BewtsMemoEditor from "@/components/BewtsMemoEditor";
import { cn } from "@/lib/cn";
import { formatTimeAgo } from "@/utils/date";
import { fetcher } from "@/utils/fetcher";
import Image from "next/image";
import Link from "next/link";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { FiDownload } from "react-icons/fi";
import { MdOutlineDeleteOutline } from "react-icons/md";
import { RxEnterFullScreen } from "react-icons/rx";
import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

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
};

type Room = {
  id: number;
  name: string;
  viewerUserId?: number;
  project?: {
    leaderId: number;
  } | null;
  members?: {
    userId: number;
    user: {
      id: number;
      name: string;
      image: string | null;
      publicId: string;
    };
  }[];
};

type ActionMenuButton = {
  key?: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
};

type Props = {
  roomId: number;
  projectPublicId: string;
  currProjectId?: number;
  chatEditorActionMenuButtons?: ActionMenuButton[];
  searchQuery?: string;
  currentUserName?: string | null;
};

export type BewtsChatAreaHandle = {
  focusNextHit: () => void;
  focusPrevHit: () => void;
};

// --- 同一のヘルパ関数は ChatArea と同じロジックを使用 ---
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

function toDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

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

function shouldRenderMessageContent(msg: ChatMessage): boolean {
  const hasVisibleContent = hasVisibleContentFromHtml(msg.content || "");
  const hasAttachments = (msg.attachments || []).length > 0;
  if (!hasVisibleContent && hasAttachments) return false;
  return true;
}

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

export const BewtsChatArea = forwardRef<BewtsChatAreaHandle, Props>(
  (
    {
      roomId,
      projectPublicId,
      chatEditorActionMenuButtons,
      searchQuery,
      currentUserName,
    }: Props,
    ref,
  ) => {
    const [showMemo, setShowMemo] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [room, setRoom] = useState<Room | null>(null);
    const [isRoomLoading, setIsRoomLoading] = useState(true);
    type Attachment = {
      id: number | string;
      url: string;
      type: string;
      name?: string | null;
      file?: File;
    };
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isMessagesInitialLoading, setIsMessagesInitialLoading] =
      useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hoveredMessageId, setHoveredMessageId] = useState<number | null>(
      null,
    );
    const [isMentionPreviewVisible, setIsMentionPreviewVisible] =
      useState(false);
    const [emojiPickerOpenMessageId, setEmojiPickerOpenMessageId] = useState<
      number | null
    >(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const editorRef = useRef<{
      getHTML: () => string;
      getText: () => string;
      clearContent: () => void;
      setContent: (html: string) => void;
      focus: () => void;
    } | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [messageToDelete, setMessageToDelete] = useState<{
      id: number;
      publicId: string;
    } | null>(null);
    const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
      null,
    );

    const normalizedSearchQuery = (searchQuery ?? "").trim();
    const messagesContainerRef = useRef<HTMLDivElement | null>(null);
    const hitElementsRef = useRef<HTMLElement[]>([]);
    const [_currentHitIndex, setCurrentHitIndex] = useState<number | null>(
      null,
    );

    const mentionUsers = useMemo(() => {
      if (!room?.members?.length) return [];
      const myId = room.viewerUserId;

      return room.members
        .filter((member) => member.user?.publicId)
        .filter((member) => {
          if (typeof myId !== "number") return true;
          return member.userId !== myId;
        })
        .map((member) => ({
          id: member.user.publicId,
          label: member.user.name,
          image: member.user.image,
        }));
    }, [room]);

    const loadMessages = useCallback(async () => {
      try {
        const data = await fetcher<ChatMessage[]>(
          `/api/bewts/rooms/${roomId}/messages`,
        );
        if (Array.isArray(data)) {
          setMessages(data);
          setTimeout(() => messagesEndRef.current?.scrollIntoView(), 100);
        }
      } catch (e) {
        console.error("Failed to load bewts messages", e);
      } finally {
        setIsMessagesInitialLoading(false);
      }
    }, [roomId]);

    const loadRoom = useCallback(async () => {
      try {
        const data = await fetcher<Room>(`/api/bewts/rooms/${roomId}`);
        setRoom(data);
      } catch (e) {
        console.error("Failed to load bewts room", e);
      } finally {
        setIsRoomLoading(false);
      }
    }, [roomId]);

    const handleDeleteMessage = useCallback(
      async (messagePublicId: string) => {
        try {
          await fetcher(
            `/api/bewts/rooms/${roomId}/messages/${messagePublicId}`,
            { method: "DELETE" },
          );
          await loadMessages();
        } catch (err) {
          console.error("Failed to delete bewts message", err);
          throw err;
        }
      },
      [roomId, loadMessages],
    );

    useEffect(() => {
      function handleMemoClose(e: Event) {
        try {
          const detail = (e as CustomEvent)?.detail;
          const rid = detail?.roomId != null ? Number(detail.roomId) : null;
          if (rid == null) {
            setShowMemo(false);
            return;
          }
          const current = room?.id ?? roomId;
          if (Number(current) === rid) setShowMemo(false);
        } catch (_err) {
          setShowMemo(false);
        }
      }
      window.addEventListener(
        "bewts:memo:close",
        handleMemoClose as EventListener,
      );
      return () =>
        window.removeEventListener(
          "bewts:memo:close",
          handleMemoClose as EventListener,
        );
    }, [room, roomId]);

    useEffect(() => {
      const handler = () => {
        loadMessages();
      };
      window.addEventListener("chat:messages-cleared", handler);
      return () => window.removeEventListener("chat:messages-cleared", handler);
    }, [loadMessages]);

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
        const uploadedAttachments: {
          url: string;
          type: string;
          name?: string;
        }[] = [];
        for (const att of attachments) {
          if (att.file) {
            const formData = new FormData();
            formData.append("file", att.file);
            const data = await fetcher<{
              url: string;
              type: string;
              name: string;
            }>("/api/bewts/chat/upload", {
              method: "POST",
              body: formData,
            });
            uploadedAttachments.push({
              url: data.url,
              type: att.type,
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
            `/api/bewts/rooms/${roomId}/messages/${editingMessage.publicId}`,
            {
              method: "PATCH",
              body: JSON.stringify(validationResult.data),
            },
          );
        } else {
          await fetcher(`/api/bewts/rooms/${roomId}/messages`, {
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
        if (e instanceof Error) setError(e.message || "送信に失敗しました");
        else setError("送信に失敗しました");
      } finally {
        setIsLoading(false);
      }
    }, [isLoading, attachments, roomId, loadMessages, editingMessage]);

    useEffect(() => {
      loadMessages();
      loadRoom();
    }, [loadMessages, loadRoom]);

    const shouldShowSkeleton =
      isMessagesInitialLoading && messages.length === 0;

    const firstMatchedMessageId = useMemo(() => {
      if (!normalizedSearchQuery) return null;
      const q = normalizedSearchQuery.toLowerCase();
      const found = messages.find((msg) => {
        const content = (msg.content || "").toLowerCase();
        const userName = (msg.user.name || "").toLowerCase();
        return content.includes(q) || userName.includes(q);
      });
      return found?.id ?? null;
    }, [messages, normalizedSearchQuery]);

    useEffect(() => {
      if (!normalizedSearchQuery || !firstMatchedMessageId) return;
      const el = messageRefs.current[firstMatchedMessageId];
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }, [normalizedSearchQuery, firstMatchedMessageId]);

    const collectHits = useCallback(() => {
      if (!messagesContainerRef.current || !normalizedSearchQuery) {
        hitElementsRef.current = [];
        setCurrentHitIndex(null);
        return;
      }

      // TipTap 本文のハイライトと、ユーザ名の <mark> の両方を対象にする
      const nodeList =
        messagesContainerRef.current.querySelectorAll<HTMLElement>(
          'mark[data-search-highlight="true"], .' + styles.senderName + " mark",
        );
      hitElementsRef.current = Array.from(nodeList);
      setCurrentHitIndex(hitElementsRef.current.length > 0 ? 0 : null);
    }, [normalizedSearchQuery]);

    useEffect(() => {
      if (!normalizedSearchQuery) {
        hitElementsRef.current = [];
        setCurrentHitIndex(null);
        return;
      }

      // TipTap 側のハイライト適用後に実行されるように次フレームで収集
      const id = window.setTimeout(() => {
        collectHits();
      }, 0);
      return () => window.clearTimeout(id);
    }, [normalizedSearchQuery, collectHits]);

    const scrollToHit = useCallback((index: number) => {
      const el = hitElementsRef.current[index];
      if (!el) return;
      const row = el.closest(`.${styles.messageRow}`) as HTMLElement | null;
      (row ?? el).scrollIntoView({ block: "center", behavior: "smooth" });
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        focusNextHit() {
          const hits = hitElementsRef.current;
          if (!hits.length) return;
          setCurrentHitIndex((prev) => {
            const next = prev == null ? 0 : (prev + 1) % hits.length;
            scrollToHit(next);
            return next;
          });
        },
        focusPrevHit() {
          const hits = hitElementsRef.current;
          if (!hits.length) return;
          setCurrentHitIndex((prev) => {
            const base = prev == null ? 0 : prev;
            const next = (base - 1 + hits.length) % hits.length;
            scrollToHit(next);
            return next;
          });
        },
      }),
      [scrollToHit],
    );

    const groupedMessages = messages.reduce(
      (groups, msg) => {
        const key = toDateKey(msg.createdAt);
        if (!groups[key])
          groups[key] = { label: formatDateLabel(msg.createdAt), messages: [] };
        groups[key].messages.push(msg);
        return groups;
      },
      {} as Record<string, { label: string; messages: ChatMessage[] }>,
    );

    const dateGroups = Object.entries(groupedMessages);

    const headerMembers = useMemo(() => {
      if (!room?.members || room.members.length === 0) return [];
      const leaderId = room.project?.leaderId;
      const membersWithUser = room.members.filter((m) => !!m.user);
      const sorted = [...membersWithUser].sort((a, b) => {
        const aIsLeader =
          leaderId != null && (a.userId === leaderId || a.user.id === leaderId);
        const bIsLeader =
          leaderId != null && (b.userId === leaderId || b.user.id === leaderId);
        if (aIsLeader === bIsLeader) return 0;
        return aIsLeader ? -1 : 1;
      });
      return sorted;
    }, [room]);

    const showReadCount = useMemo(() => {
      if (!room?.members || room.members.length === 0) return false;
      const othersCount = room.members.length - 1;
      return othersCount >= 2;
    }, [room]);

    const editorPlaceholder = "メッセージを入力...";

    const skeletonWidths = [180, 150, 200, 170, 160];

    return (
      <div className={styles.chatArea}>
        <div className={styles.header}>
          <div className={styles.headerTitle} style={{ cursor: "default" }}>
            {isRoomLoading ? (
              <span className={styles.headerTitleSkeleton} aria-hidden="true" />
            ) : (
              (room?.name ?? "チャット")
            )}
          </div>
          {headerMembers.length > 0 && (
            <div className={styles.headerMembers}>
              <div className={styles.headerTools}>
                <Link
                  href={`/bewts/${projectPublicId}/chat/${room?.id ?? roomId}/gantt`}
                  className={styles.headerToolButton}
                  aria-label="ガントチャートを開く"
                  data-room-id={room?.id ?? roomId}
                >
                  <Image
                    src="/images/gantt.png"
                    alt="ガントチャート"
                    width={20}
                    height={20}
                  />
                </Link>
                <button
                  type="button"
                  className={styles.headerToolButton}
                  aria-label="ビューズメモを開く"
                  data-room-id={room?.id ?? roomId}
                  onClick={() => setShowMemo((s) => !s)}
                >
                  <Image
                    src="/images/memo.png"
                    alt="ビューズメモ"
                    width={20}
                    height={20}
                  />
                </button>
              </div>
              <div className={styles.memberAvatars}>
                {headerMembers.slice(0, 4).map((m) => {
                  const leaderId = room?.project?.leaderId;
                  const isLeader =
                    leaderId != null &&
                    (m.userId === leaderId || m.user.id === leaderId);

                  return (
                    <div
                      key={m.user.publicId}
                      title={m.user.name}
                      className={styles.memberBubble}
                    >
                      <Avatar
                        src={m.user.image}
                        alt={`${m.user.name}さんのアイコン`}
                        className={styles.memberAvatar}
                      />
                      {isLeader && (
                        <Image
                          src="/images/leader.png"
                          alt="リーダー"
                          className={styles.leaderBadge}
                          width={20}
                          height={20}
                        />
                      )}
                    </div>
                  );
                })}
                {headerMembers.length > 4 && (
                  <div className={cn(styles.memberBubble, styles.moreBubble)}>
                    +{headerMembers.length - 4}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={styles.messagesCont}>
          <div className={styles.messages} ref={messagesContainerRef}>
            <div
              className={cn(
                styles.messagesSkeleton,
                shouldShowSkeleton
                  ? styles.messagesSkeletonVisible
                  : styles.messagesSkeletonHidden,
              )}
              aria-hidden={!isMessagesInitialLoading || messages.length > 0}
            >
              {skeletonWidths.map((width, i) => (
                <div
                  key={width}
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
                  <div className={styles.dateLabelWrapper}>
                    <span className={styles.dateLabel}>{group.label}</span>
                  </div>

                  {group.messages.map((msg) => {
                    const leaderId = room?.project?.leaderId;
                    const isLeaderMessage =
                      leaderId != null && msg.user.id === leaderId;
                    const reactionCounts = msg.reactions;
                    const userReactedEmojis = msg.reactions
                      .filter((r) => r.userReacted)
                      .map((r) => r.emoji);
                    const isEmojiOnlySmall = isEmojiOnlySmallFromHtml(
                      msg.content || "",
                    );

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          styles.messageRow,
                          msg.isOwn && styles.own,
                        )}
                      >
                        {!msg.isOwn && (
                          <div className={styles.messageAvatarWrapper}>
                            <Avatar
                              src={msg.user.image}
                              alt={msg.user.name}
                              className={styles.messageAvatar}
                            />
                            {isLeaderMessage && (
                              <Image
                                src="/images/leader.png"
                                alt="リーダー"
                                className={styles.leaderBadge}
                                width={20}
                                height={20}
                              />
                            )}
                          </div>
                        )}
                        <div className={styles.messageRightSide}>
                          {!msg.isOwn && (
                            <span className={styles.senderName}>
                              <HighlightedText
                                text={msg.user.name}
                                keyword={normalizedSearchQuery}
                              />
                            </span>
                          )}

                          <div className={styles.messageAndTime}>
                            <div className={styles.time}>
                              {msg.isOwn && msg.isRead && (
                                <div className={styles.readStatus}>
                                  {showReadCount &&
                                  typeof msg.readBy === "number"
                                    ? `既読 ${msg.readBy}`
                                    : "既読"}
                                </div>
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
                                endpoint={`/api/bewts/rooms/${roomId}/messages/${msg.publicId}/reactions`}
                                initialUserEmojiStats={[]}
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
                                onUpdate={(data: {
                                  reactions: ReactionCount[];
                                  userReactedEmojis: string[];
                                }) => {
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

                              {shouldRenderMessageContent(msg) ? (
                                <MessageContent
                                  content={msg.content || ""}
                                  highlightKeyword={normalizedSearchQuery}
                                  className={styles.messageContent}
                                  onMentionPreviewVisibleChange={
                                    setIsMentionPreviewVisible
                                  }
                                />
                              ) : null}

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
                                          "ダウンロードされたファイル";
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
                                            <PhotoView
                                              src={att.url}
                                              key={att.id}
                                            >
                                              <div
                                                className={
                                                  styles.attachmentThumb
                                                }
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
                                                {getFileIcon(
                                                  att.type,
                                                  att.name,
                                                )}
                                              </div>
                                              <div className={styles.fileInfo}>
                                                <span
                                                  className={styles.fileName}
                                                >
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
                              endpoint={`/api/bewts/rooms/${roomId}/messages/${msg.publicId}/reactions`}
                              reactions={reactionCounts}
                              userReactedEmojis={userReactedEmojis}
                              onUpdate={(data: {
                                reactions: ReactionCount[];
                                userReactedEmojis: string[];
                              }) => {
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

        <div className={styles.chatEditorWrapper}>
          {editingMessage && (
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
          <div>
            <ChatEditor
              ref={editorRef}
              attachments={attachments}
              setAttachments={setAttachments}
              onSend={handleSend}
              isLoading={isLoading}
              externalError={error}
              placeholder={
                editingMessage ? "メッセージを編集..." : editorPlaceholder
              }
              autoFocus
              actionMenuButtons={chatEditorActionMenuButtons}
              mentionUsers={mentionUsers}
            />
          </div>
        </div>

        {showMemo && (
          <BewtsMemoEditor
            roomId={room?.id ?? roomId}
            roomName={room?.name ?? undefined}
            userName={currentUserName ?? "Guest"}
            nameMaxLength={12}
          />
        )}

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
  },
);
