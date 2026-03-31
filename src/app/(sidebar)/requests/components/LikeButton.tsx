"use client";

import { cn } from "@/lib/cn";
import { fetcher } from "@/utils/fetcher";
import { useRef, useState } from "react";
import Emoji from "../../components/Emoji";
import { LIKE_EMOJI } from "../constants";
import styles from "./LikeButton.module.scss";

type Props = {
  requestPublicId: string;
  initialLikeCount: number;
  initialIsLiked?: boolean;
  showCount?: boolean;
  onLikeCountChange?: (newCount: number) => void;
  onLikeStatusChange?: (isLiked: boolean) => void;
};

export default function LikeButton({
  requestPublicId,
  initialLikeCount,
  initialIsLiked = false,
  showCount = true,
  onLikeCountChange,
  onLikeStatusChange,
}: Props) {
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const emojiRef = useRef<HTMLImageElement | null>(null);
  const processingRef = useRef(false);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLoading || processingRef.current) return;

    processingRef.current = true;
    setIsLoading(true);

    const newIsLiked = !isLiked;
    const optimisticCount = newIsLiked
      ? likeCount + 1
      : Math.max(0, likeCount - 1);

    // いいねを追加する場合のみアニメーション
    if (newIsLiked) {
      triggerAnimation();
    }

    setIsLiked(newIsLiked);
    setLikeCount(optimisticCount);

    onLikeStatusChange?.(newIsLiked);
    onLikeCountChange?.(optimisticCount);

    try {
      await fetcher(`/api/requests/${requestPublicId}/reactions`, {
        method: "POST",
        body: JSON.stringify({ emoji: LIKE_EMOJI }),
      });
    } catch (error) {
      console.error("いいねエラー:", error);
      setIsLiked(isLiked);
      setLikeCount(likeCount);
      onLikeStatusChange?.(isLiked);
      onLikeCountChange?.(likeCount);
    } finally {
      setIsLoading(false);
      processingRef.current = false;
    }
  };

  const triggerAnimation = () => {
    console.log("triggerAnimation called");

    setIsAnimating(false);

    setTimeout(() => {
      console.log("setTimeout executed");
      // nullチェックを削除してsetIsAnimatingだけ実行
      setIsAnimating(true);
      console.log("isAnimating set to true");
    }, 10); // 少し遅延を長くしてDOM更新を待つ
  };

  return (
    <button
      type="button"
      className={cn(styles.likeButton, isLiked && styles.liked)}
      onClick={handleLike}
      disabled={isLoading}
      aria-label={isLiked ? "いいねを取り消す" : "いいね"}
    >
      <Emoji
        emoji={LIKE_EMOJI}
        className={cn(styles.emoji, isAnimating && styles.animate)}
        ref={emojiRef}
      />

      {showCount && (
        <span
          className={cn(styles.count, likeCount > 0 && styles.countVisible)}
        >
          {likeCount}
        </span>
      )}
    </button>
  );
}
