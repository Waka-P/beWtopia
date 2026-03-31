"use client";

import { cn } from "@/lib/cn";
import { fetcher } from "@/utils/fetcher";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Emoji from "./Emoji";
import styles from "./ReactionBar.module.scss";

// firstReactedAt の昇順（小さい順）でソートするヘルパー
const sortReactionsByFirstReactedAt = (rs: ReactionCount[]) =>
  [...rs].sort(
    (a, b) =>
      new Date(a.firstReactedAt).getTime() -
      new Date(b.firstReactedAt).getTime(),
  );

export type ReactionCount = {
  emoji: string;
  firstReactedAt: string;
  count: number;
  userReacted?: boolean;
};

type Props = {
  endpoint: string;
  reactions: ReactionCount[];
  userReactedEmojis?: string[];
  className?: string;
  onUpdate?: (data: {
    reactions: ReactionCount[];
    userReactedEmojis: string[];
  }) => void;
};

export default function ReactionBar({
  endpoint,
  reactions,
  userReactedEmojis = [],
  className,
  onUpdate,
}: Props) {
  const router = useRouter();
  const [localReactions, setLocalReactions] = useState(() =>
    sortReactionsByFirstReactedAt(reactions),
  );
  const [userReacted, setUserReacted] = useState<Set<string>>(
    new Set(userReactedEmojis),
  );
  const [pendingEmojis, setPendingEmojis] = useState<Set<string>>(new Set());
  const [animatingEmojis, setAnimatingEmojis] = useState<Set<string>>(
    new Set(),
  );
  const processingRef = useRef<Set<string>>(new Set());
  const previousUserReacted = useRef<Set<string>>(new Set(userReactedEmojis));

  useEffect(() => {
    setLocalReactions(sortReactionsByFirstReactedAt(reactions));

    const newUserReacted = new Set(userReactedEmojis);

    // 新しく追加されたリアクションを検出してアニメーション
    userReactedEmojis.forEach((emoji) => {
      if (!previousUserReacted.current.has(emoji)) {
        setAnimatingEmojis((prev) => new Set(prev).add(emoji));
        setTimeout(() => {
          setAnimatingEmojis((prev) => {
            const next = new Set(prev);
            next.delete(emoji);
            return next;
          });
        }, 500);
      }
    });

    setUserReacted(newUserReacted);
    previousUserReacted.current = newUserReacted;
  }, [reactions, userReactedEmojis]);

  const handleReaction = async (emoji: string) => {
    if (pendingEmojis.has(emoji) || processingRef.current.has(emoji)) {
      return;
    }

    processingRef.current.add(emoji);
    setPendingEmojis((prev) => new Set(prev).add(emoji));

    const originalReactions = [...localReactions];
    const originalUserReacted = new Set(userReacted);
    const wasUserReacted = userReacted.has(emoji);

    let optimisticReactions: ReactionCount[];
    const optimisticUserReacted = new Set(userReacted);

    if (wasUserReacted) {
      optimisticUserReacted.delete(emoji);
      optimisticReactions = localReactions
        .map((r) =>
          r.emoji === emoji
            ? { ...r, count: Math.max(0, r.count - 1), userReacted: false }
            : r,
        )
        .filter((r) => r.count > 0);
    } else {
      // リアクション追加時のみアニメーションをトリガー
      setAnimatingEmojis((prev) => new Set(prev).add(emoji));
      setTimeout(() => {
        setAnimatingEmojis((prev) => {
          const next = new Set(prev);
          next.delete(emoji);
          return next;
        });
      }, 500);

      optimisticUserReacted.add(emoji);
      const existing = localReactions.find((r) => r.emoji === emoji);
      if (existing) {
        optimisticReactions = localReactions.map((r) =>
          r.emoji === emoji
            ? { ...r, count: r.count + 1, userReacted: true }
            : r,
        );
      } else {
        optimisticReactions = [
          ...localReactions,
          {
            emoji,
            firstReactedAt: new Date().toISOString(),
            count: 1,
            userReacted: true,
          },
        ];
      }
    }

    setLocalReactions(sortReactionsByFirstReactedAt(optimisticReactions));
    setUserReacted(optimisticUserReacted);
    previousUserReacted.current = optimisticUserReacted;

    try {
      const data = await fetcher<{
        reactions: ReactionCount[];
        userReactedEmojis: string[];
      }>(endpoint, {
        method: "POST",
        body: JSON.stringify({ emoji }),
      });

      if (data.reactions && data.userReactedEmojis) {
        setLocalReactions(sortReactionsByFirstReactedAt(data.reactions));
        setUserReacted(new Set(data.userReactedEmojis));
        previousUserReacted.current = new Set(data.userReactedEmojis);
        if (typeof onUpdate === "function") {
          onUpdate({
            reactions: data.reactions,
            userReactedEmojis: data.userReactedEmojis,
          });
        }
      }

      router.refresh();
    } catch (error) {
      console.error("❌ リアクションエラー:", error);
      setLocalReactions(originalReactions);
      setUserReacted(originalUserReacted);
      previousUserReacted.current = originalUserReacted;
    } finally {
      setPendingEmojis((prev) => {
        const next = new Set(prev);
        next.delete(emoji);
        return next;
      });
      processingRef.current.delete(emoji);
    }
  };

  return (
    <div className={cn(styles.reactionBar, className)}>
      {localReactions.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          className={cn(
            styles.reactionButton,
            userReacted.has(reaction.emoji) && styles.userReacted,
            pendingEmojis.has(reaction.emoji) && styles.pending,
            animatingEmojis.has(reaction.emoji) && styles.animating,
          )}
          onClick={() => handleReaction(reaction.emoji)}
          disabled={pendingEmojis.has(reaction.emoji)}
          aria-label={`${reaction.emoji} ${reaction.count}件 ${userReacted.has(reaction.emoji) ? "(リアクション済み)" : ""}`}
        >
          <span className={styles.emoji}>
            <Emoji emoji={reaction.emoji} />
          </span>
          <span className={styles.count}>{reaction.count}</span>
        </button>
      ))}
    </div>
  );
}
