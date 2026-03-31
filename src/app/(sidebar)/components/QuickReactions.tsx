"use client";

import EmojiPicker from "@/app/(sidebar)/components/EmojiPicker";
import { cn } from "@/lib/cn";
import { DEFAULT_REACTION_EMOJIS } from "@/lib/constants";
import { fetcher } from "@/utils/fetcher";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";
import type { EmojiClickData } from "emoji-picker-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Emoji from "./Emoji";
import styles from "./QuickReactions.module.scss";

type ReactionCount = {
  emoji: string;
  firstReactedAt: string;
  count: number;
  userReacted?: boolean;
};

type AdditionalButton = {
  className?: string;
  icon: React.ReactNode;
  onClick: () => void;
  label: string;
};

type Props = {
  show: boolean;
  endpoint: string;
  /** anchorRef を渡すとその要素を基準に position を計算（div などを指定可） */
  anchorRef?: React.RefObject<HTMLElement | null>;
  /** anchorRef の内部（親コンテナの内側）に固定したい時に使用: 'top' | 'bottom' */
  anchorInside?: "top" | "bottom";
  initialUserEmojiStats?: string[];
  classNames?: Partial<{
    quickReactions: string;
    emojiPicker: string;
  }>;
  /** 追加のアクションボタン（削除、編集など） */
  additionalButtons?: AdditionalButton[];
  onEmojiPickerOpen?: () => void;
  onEmojiPickerClose?: () => void;
  onUpdate?: (data: {
    reactions: ReactionCount[];
    userReactedEmojis: string[];
  }) => void;
};

export default function QuickReactions({
  show,
  endpoint,
  anchorRef,
  /** コンテナ内に固定表示したい場合に 'top' | 'bottom' を指定 */
  anchorInside,
  initialUserEmojiStats,
  classNames,
  additionalButtons,
  onEmojiPickerOpen,
  onEmojiPickerClose,
  onUpdate,
}: Props) {
  const router = useRouter();
  const [showEmojiPicker, setShowEmojiPickerInternal] = useState(false);

  const setShowEmojiPicker = (value: boolean) => {
    setShowEmojiPickerInternal(value);
    if (value) {
      onEmojiPickerOpen?.();
    } else {
      onEmojiPickerClose?.();
    }
  };
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [pendingEmojis, setPendingEmojis] = useState<Set<string>>(new Set());
  const processingRef = useRef<Set<string>>(new Set());
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const topEmojisRef = useRef<string[]>(DEFAULT_REACTION_EMOJIS.slice(0, 5));
  const addBtnRef = useRef<HTMLButtonElement | null>(null);

  const showQuickReactions = show || showEmojiPicker;

  // floating-ui を使って anchorRef に合わせて配置（anchorRef が与えられた場合のみスタイルを適用）
  const { refs, floatingStyles } = useFloating({
    elements: { reference: undefined },
    open: showQuickReactions,
    placement: "top-start",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip({ fallbackPlacements: ["bottom-start", "top-end", "bottom-end"] }),
      shift({ padding: 8 }),
    ],
  });

  // anchorRef が外から渡された場合は reference を差し替える
  useEffect(() => {
    if (anchorRef?.current) {
      refs.setReference(anchorRef.current);
    } else {
      // clear reference so floating-ui won't position relative to an absent element
      refs.setReference(null);
    }
  }, [anchorRef, refs.setReference]);

  // --- スタイル決定ロジック ---
  // バグ修正: anchorRef と「幅が一致してしまう」問題を防ぐため、
  // floatingStyles の width/maxWidth を除去して適用します。
  // また anchorInside が指定された場合は floating-ui を使わず
  // 親コンテナ内のトップ/ボトムに `position: absolute` で固定します。
  const computedWrapperStyle: React.CSSProperties | undefined = (() => {
    if (!anchorRef?.current) return undefined;

    if (anchorInside === "top") {
      return { position: "absolute", top: 0, marginTop: "8px" };
    }
    if (anchorInside === "bottom") {
      return { position: "absolute", bottom: 0, marginBottom: "8px" };
    }

    // floatingStyles から幅関連を除去して適用（width を除くことで"アンカーと幅が一致する"問題を防ぐ）
    const rest = { ...(floatingStyles || {}) } as React.CSSProperties;
    // safety: remove possible width-like props that would force size
    const _rec = rest as unknown as Record<string, unknown>;
    delete _rec.width;
    delete _rec.maxWidth;
    return Object.keys(rest).length ? rest : undefined;
  })();

  // 絵文字統計取得
  useEffect(() => {
    if (initialUserEmojiStats && initialUserEmojiStats.length > 0) {
      const combined = [
        ...initialUserEmojiStats,
        ...DEFAULT_REACTION_EMOJIS.filter(
          (e) => !initialUserEmojiStats.includes(e as string),
        ),
      ]
        .slice(0, 5)
        .sort((a, b) => {
          const indexA = (DEFAULT_REACTION_EMOJIS as readonly string[]).indexOf(
            a,
          );
          const indexB = (DEFAULT_REACTION_EMOJIS as readonly string[]).indexOf(
            b,
          );
          const orderA = indexA !== -1 ? indexA : Number.MAX_SAFE_INTEGER;
          const orderB = indexB !== -1 ? indexB : Number.MAX_SAFE_INTEGER;
          return orderA - orderB;
        });

      topEmojisRef.current = combined;
      return;
    }

    const fetchUserEmojis = async () => {
      try {
        const data = await fetcher<{ emojis: string[] }>(
          "/api/users/emoji-stats",
        );
        if (data.emojis && data.emojis.length > 0) {
          const combined = [
            ...data.emojis,
            ...DEFAULT_REACTION_EMOJIS.filter(
              (e) => !data.emojis.includes(e as string),
            ),
          ]
            .slice(0, 5)
            .sort((a, b) => {
              const indexA = (
                DEFAULT_REACTION_EMOJIS as readonly string[]
              ).indexOf(a);
              const indexB = (
                DEFAULT_REACTION_EMOJIS as readonly string[]
              ).indexOf(b);
              const orderA = indexA !== -1 ? indexA : Number.MAX_SAFE_INTEGER;
              const orderB = indexB !== -1 ? indexB : Number.MAX_SAFE_INTEGER;
              return orderA - orderB;
            });

          topEmojisRef.current = combined;
        } else {
          topEmojisRef.current = DEFAULT_REACTION_EMOJIS.slice(0, 5);
        }
      } catch (error) {
        console.error("絵文字統計取得エラー:", error);
        topEmojisRef.current = DEFAULT_REACTION_EMOJIS.slice(0, 5);
      }
    };

    if (
      topEmojisRef.current.length === 0 ||
      topEmojisRef.current.every((emoji) =>
        (DEFAULT_REACTION_EMOJIS as readonly string[]).includes(emoji),
      )
    ) {
      fetchUserEmojis();
    }
  }, [initialUserEmojiStats]);

  useEffect(() => {
    if (show) {
      setShouldRender(true);
      setIsAnimatingOut(false);
    }
  }, [show]);

  useEffect(() => {
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current);
    }

    if (showQuickReactions) {
      setShouldRender(true);
      setIsAnimatingOut(false);
    } else {
      setIsAnimatingOut(true);
      animationTimerRef.current = setTimeout(() => {
        setShouldRender(false);
        setIsAnimatingOut(false);
      }, 200);
    }

    return () => {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
    };
  }, [showQuickReactions]);

  const EMOJI_DISPLAY_SIZE = 18; // smaller than default 24 for compact quick reactions

  const handleReaction = async (emoji: string) => {
    if (pendingEmojis.has(emoji) || processingRef.current.has(emoji)) {
      return;
    }

    processingRef.current.add(emoji);
    setPendingEmojis((prev) => new Set(prev).add(emoji));

    try {
      const data = await fetcher<{
        reactions: ReactionCount[];
        userReactedEmojis: string[];
      }>(endpoint, {
        method: "POST",
        body: JSON.stringify({ emoji }),
      });

      // onUpdateコールバックが提供されている場合は呼び出す
      if (
        data.reactions &&
        data.userReactedEmojis &&
        typeof onUpdate === "function"
      ) {
        onUpdate({
          reactions: data.reactions,
          userReactedEmojis: data.userReactedEmojis,
        });
      }

      router.refresh();
    } catch (error) {
      console.error("❌ リアクションエラー:", error);
    } finally {
      setPendingEmojis((prev) => {
        const next = new Set(prev);
        next.delete(emoji);
        return next;
      });
      processingRef.current.delete(emoji);
      setShowEmojiPicker(false);
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    handleReaction(emojiData.emoji);
  };

  if (!shouldRender) return null;

  return (
    <div
      ref={(node) => refs.setFloating(node)}
      className={cn(styles.quickReactionsWrapper, classNames?.quickReactions)}
      style={computedWrapperStyle}
    >
      <div
        className={cn(styles.quickReactions, isAnimatingOut && styles.slideOut)}
      >
        {topEmojisRef.current.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className={cn(
              styles.quickReactionButton,
              pendingEmojis.has(emoji) && styles.pending,
            )}
            onClick={() => handleReaction(emoji)}
            disabled={pendingEmojis.has(emoji)}
            aria-label={`${emoji}でリアクション`}
          >
            <Emoji emoji={emoji} size={EMOJI_DISPLAY_SIZE} />
          </button>
        ))}
        <button
          type="button"
          className={styles.addReactionButton}
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          aria-label="その他の絵文字を選択"
          ref={addBtnRef}
        >
          +
        </button>

        {additionalButtons && additionalButtons.length > 0 && (
          <>
            <div className={styles.divider} />
            {additionalButtons.map((btn, idx) => (
              <button
                // biome-ignore lint: indexをkeyに使用
                key={idx}
                type="button"
                className={cn(styles.additionalButton, btn.className)}
                onClick={btn.onClick}
                aria-label={btn.label}
              >
                {btn.icon}
              </button>
            ))}
          </>
        )}
      </div>

      <EmojiPicker
        open={showEmojiPicker}
        onEmojiClick={onEmojiClick}
        anchorRef={addBtnRef}
        onClose={() => setShowEmojiPicker(false)}
        className={cn(styles.emojiPicker, classNames?.emojiPicker)}
      />
    </div>
  );
}
