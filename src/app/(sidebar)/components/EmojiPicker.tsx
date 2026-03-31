"use client";

import { cn } from "@/lib/cn";
import {
  autoUpdate,
  flip,
  offset,
  type Placement,
  shift,
  size,
  useFloating,
} from "@floating-ui/react";
import type { EmojiClickData, Theme } from "emoji-picker-react";
import { Categories, EmojiStyle } from "emoji-picker-react";
import ja from "emoji-picker-react/dist/data/emojis-ja";
import dynamic from "next/dynamic";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./EmojiPicker.module.scss";
import "./EmojiPicker.scss";

const EmojiPickerReact = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
});

type CategoryConfig = {
  category: Categories;
  name: string;
};

type Position = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

type EmojiPickerProps = {
  /** 絵文字ピッカーの表示/非表示を制御 */
  open?: boolean;
  /** 絵文字が選択された時のハンドラ */
  onEmojiClick: (emojiData: EmojiClickData) => void;
  /** ピッカーを閉じる時のハンドラ */
  onClose?: () => void;
  /** ピッカーの位置 */
  position?: Position;
  /** アンカーボタンの ref を渡すとポータルでアンカー元の上に表示します */
  anchorRef?: React.RefObject<HTMLElement | null>;
  /** 検索プレースホルダー */
  searchPlaceHolder?: string;
  /** 絵文字スタイル */
  emojiStyle?: EmojiStyle;
  /** 幅 */
  width?: number;
  /** 高さ */
  height?: number;
  /** カテゴリー設定 */
  categories?: CategoryConfig[];
  /** テーマ設定 */
  theme?: Theme;
  /** 外側クリックで閉じるかどうか */
  closeOnClickOutside?: boolean;
  /** カスタムクラス名 */
  className?: string;
  /** カスタムスタイル */
  style?: CSSProperties;
  placement?: Placement;
};

const DEFAULT_CATEGORIES: CategoryConfig[] = [
  {
    category: Categories.SUGGESTED,
    name: "よく使う絵文字",
  },
  {
    category: Categories.SMILEYS_PEOPLE,
    name: "顔文字と人物",
  },
  {
    category: Categories.ANIMALS_NATURE,
    name: "動物と自然",
  },
  {
    category: Categories.FOOD_DRINK,
    name: "食べ物と飲み物",
  },
  {
    category: Categories.TRAVEL_PLACES,
    name: "旅行と場所",
  },
  {
    category: Categories.ACTIVITIES,
    name: "アクティビティ",
  },
  {
    category: Categories.OBJECTS,
    name: "オブジェクト",
  },
  {
    category: Categories.SYMBOLS,
    name: "記号",
  },
  {
    category: Categories.FLAGS,
    name: "国旗",
  },
];

const DEFAULT_PREVIEW_CAPTIONS = [
  "絵文字を選択してください",
  "お気に入りの絵文字を見つけよう！",
  "ここに絵文字が表示されます",
  "絵文字をクリックして追加",
  "リアクションを選んでみましょう",
  "絵文字で気持ちを表現しよう",
  "好きな絵文字を選んでください",
  "絵文字を使って反応を追加",
  "絵文字をクリックしてリアクション",
  "絵文字で感情をシェアしよう",
];

export default function EmojiPicker({
  open = true,
  onEmojiClick,
  onClose,
  searchPlaceHolder = "絵文字を検索...",
  emojiStyle = EmojiStyle.APPLE,
  width = 400,
  height = 450,
  categories = DEFAULT_CATEGORIES,
  closeOnClickOutside = true,
  className,
  style,
  anchorRef,
  placement = "top-end",
}: EmojiPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // ★ Floating UI のセットアップ
  const { refs, floatingStyles } = useFloating({
    open: shouldRender,
    strategy: "fixed",
    placement, // デフォルト配置（上下のみ反転）
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8), // アンカーとの隙間
      flip({
        // 上に置けなければ下へ
        fallbackPlacements: [
          placement.split("-")[1] === "start" ? "bottom-start" : "bottom-end",
        ],
      }),
      shift({
        // 画面端にはみ出したら水平方向のみずらす（縦方向はずらさない）
        padding: 8,
        mainAxis: false,
        crossAxis: true,
      }),
      size({
        // 画面に収まるようにサイズを制限
        padding: 8,
        apply({ availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            maxHeight: `${availableHeight}px`,
          });
        },
      }),
    ],
  });

  useEffect(() => {
    if (anchorRef?.current) {
      refs.setReference(anchorRef.current);
      return;
    }
    refs.setReference(null);
  }, [anchorRef, refs]);

  useEffect(() => {
    if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    if (open) {
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
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    };
  }, [open]);

  useEffect(() => {
    if (!shouldRender || !closeOnClickOutside) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (pickerRef.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      onClose?.();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [shouldRender, closeOnClickOutside, onClose, anchorRef]);

  if (!shouldRender) return null;

  const content = (
    <div
      // ★ refs.setFloating で Floating UI に要素を登録
      ref={(node) => {
        refs.setFloating(node);
        (pickerRef as React.MutableRefObject<HTMLDivElement | null>).current =
          node;
      }}
      className={cn(
        styles.pickerWrapper,
        isAnimatingOut && styles.fadeOut,
        className,
      )}
      // ★ floatingStyles をそのまま当てる（position/top/left等が入る）
      style={{ ...floatingStyles, width, ...style }}
    >
      <EmojiPickerReact
        onEmojiClick={onEmojiClick}
        width={width}
        height={height}
        emojiStyle={emojiStyle}
        searchPlaceHolder={searchPlaceHolder}
        previewConfig={{
          showPreview: true,
          defaultCaption:
            DEFAULT_PREVIEW_CAPTIONS[
              Math.floor(Math.random() * DEFAULT_PREVIEW_CAPTIONS.length)
            ],
        }}
        categories={categories}
        emojiData={ja}
      />
    </div>
  );

  // anchorRef がある場合は必ず portal 経由で body 直下に出す
  if (anchorRef && typeof document !== "undefined") {
    return createPortal(content, document.body);
  }

  return content;
}
