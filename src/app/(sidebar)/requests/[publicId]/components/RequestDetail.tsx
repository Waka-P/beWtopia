"use client";

import QuickReactions from "@/app/(sidebar)/components/QuickReactions";
import ReactionBar from "@/app/(sidebar)/components/ReactionBar";
import Avatar from "@/components/Avatar";
import { ConfirmModal } from "@/components/ConfirmModal";
import { cn } from "@/lib/cn";
import { formatTimeAgo } from "@/utils/date";
import { fetcher } from "@/utils/fetcher";
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import styles from "./RequestDetail.module.scss";

type Tag = {
  id: number;
  name: string;
};

type Reaction = {
  id: number;
  emoji: string;
  firstReactedAt: string;
  user: {
    publicId: string;
    name: string;
  };
};

type RequestData = {
  publicId: string;
  title: string;
  content: string;
  createdAt: string;
  user: {
    name: string;
    publicId: string;
    image: string | null;
  };
  tags: Tag[];
  reactions: Reaction[];
};

type Props = {
  request: RequestData;
  userEmojiStats: string[];
  currentUserId?: string;
  canEdit?: boolean;
};

export default function RequestDetail({
  request,
  userEmojiStats,
  currentUserId,
  canEdit = false,
}: Props) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const containerRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const [titleOverflow, setTitleOverflow] = useState(0);

  const { refs, floatingStyles } = useFloating({
    open: menuOpen,
    placement: "bottom-end",
    whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  });

  const getInitialReactionData = () => {
    const counts: {
      emoji: string;
      firstReactedAt: string;
      count: number;
      userReacted: boolean;
    }[] = [];
    const userEmojis: string[] = [];

    request.reactions.forEach((r) => {
      const existing = counts.find((item) => item.emoji === r.emoji);
      const isCurrentUser = currentUserId && r.user.publicId === currentUserId;

      if (existing) {
        existing.count++;
        if (isCurrentUser) {
          existing.userReacted = true;
        }
      } else {
        counts.push({
          emoji: r.emoji,
          firstReactedAt: r.firstReactedAt,
          count: 1,
          userReacted: !!isCurrentUser,
        });
      }

      if (isCurrentUser && !userEmojis.includes(r.emoji)) {
        userEmojis.push(r.emoji);
      }
    });

    return {
      reactionCounts: counts,
      userReactedEmojis: userEmojis,
    };
  };

  const [reactionData, setReactionData] = useState(getInitialReactionData());

  useEffect(() => {
    const measure = () => {
      const titleEl = titleRef.current;
      if (!titleEl) return;
      const overflow = Math.max(titleEl.scrollWidth - titleEl.clientWidth, 0);
      setTitleOverflow(overflow);
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (containerRef.current?.matches(":hover")) {
      setIsHovered(true);
    }
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        refs.reference.current &&
        (refs.reference.current as HTMLElement).contains(target)
      )
        return;
      if (
        refs.floating.current &&
        (refs.floating.current as HTMLElement).contains(target)
      )
        return;
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen, refs]);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await fetcher(`/api/requests/${request.publicId}`, {
        method: "DELETE",
      });
      setConfirmOpen(false);
      router.push("/requests");
    } catch (error) {
      console.error("削除エラー:", error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/requests" className={styles.backLink}>
          <span>◀</span> リクエスト一覧
        </Link>
        {canEdit && (
          <button
            ref={refs.setReference}
            type="button"
            className={styles.actionMenuBtn}
            data-open={menuOpen ? "true" : undefined}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
          >
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </button>
        )}
      </div>

      <FloatingPortal>
        {/* biome-ignore lint: div */}
        <div
          ref={refs.setFloating}
          className={cn(styles.actionMenu, menuOpen && styles.show)}
          style={{
            ...floatingStyles,
            pointerEvents: menuOpen ? "auto" : "none",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <ul>
            <li>
              <Link
                href={`/requests/${request.publicId}/edit`}
                className={styles.actionMenuItem}
                onClick={() => setMenuOpen(false)}
              >
                <span>編集</span>
                <Image
                  className={styles.editImg}
                  src="/images/edit.png"
                  alt="編集"
                  width={16}
                  height={16}
                />
              </Link>
            </li>
            <li>
              <button
                type="button"
                className={cn(styles.actionMenuItem, styles.delete)}
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmOpen(true);
                }}
              >
                <span>削除</span>
                <Image
                  className={styles.deleteImg}
                  src="/images/delete.png"
                  alt="削除"
                  width={15}
                  height={15}
                />
              </button>
            </li>
          </ul>
        </div>
      </FloatingPortal>

      <section
        ref={containerRef}
        className={styles.content}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label="リクエスト詳細"
      >
        <div className={styles.titleSection}>
          <h1
            ref={titleRef}
            className={cn(
              styles.title,
              titleOverflow > 0 && styles.marqueeReady,
            )}
            style={
              {
                "--marquee-distance": `${titleOverflow}px`,
              } as CSSProperties
            }
          >
            <span className={styles.marqueeText}>{request.title}</span>
          </h1>
          <div className={styles.meta}>
            <div className={styles.author}>
              <Avatar
                src={request.user.image}
                alt={request.user.name}
                className={styles.authorAvatar}
              />
              <span className={styles.authorName}>{request.user.name}</span>
            </div>
            <span className={styles.date}>
              {formatTimeAgo(request.createdAt)}
            </span>
          </div>
        </div>

        <div className={styles.body}>
          <p>{request.content}</p>
        </div>

        <div className={styles.tags}>
          {request.tags.map((tag) => (
            <span key={tag.id} className={styles.tag}>
              {tag.name}
            </span>
          ))}
        </div>

        <div className={styles.reactionSection}>
          <ReactionBar
            endpoint={`/api/requests/${request.publicId}/reactions`}
            reactions={reactionData.reactionCounts}
            userReactedEmojis={reactionData.userReactedEmojis}
            onUpdate={(data) => {
              setReactionData({
                reactionCounts: data.reactions.map((r) => ({
                  emoji: r.emoji,
                  firstReactedAt: r.firstReactedAt,
                  count: r.count,
                  userReacted: !!r.userReacted,
                })),
                userReactedEmojis: data.userReactedEmojis,
              });
            }}
          />
        </div>
        <QuickReactions
          show={isHovered}
          endpoint={`/api/requests/${request.publicId}/reactions`}
          anchorRef={containerRef}
          anchorInside="top"
          initialUserEmojiStats={userEmojiStats}
          classNames={{
            quickReactions: styles.quickReactions,
            emojiPicker: styles.emojiPicker,
          }}
          onUpdate={(data) => {
            setReactionData({
              reactionCounts: data.reactions.map((r) => ({
                emoji: r.emoji,
                firstReactedAt: r.firstReactedAt,
                count: r.count,
                userReacted: !!r.userReacted,
              })),
              userReactedEmojis: data.userReactedEmojis,
            });
          }}
        />
      </section>

      <ConfirmModal
        open={confirmOpen}
        message="このリクエストを削除しますか？"
        appName={request.title}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
        confirmLabel={deleting ? "削除中..." : "削除"}
        cancelLabel="キャンセル"
      />
    </div>
  );
}
