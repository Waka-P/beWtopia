"use client";

import Rating from "@/app/(sidebar)/components/Rating";
import Avatar from "@/components/Avatar";
import { EmojiNode } from "@/lib/tiptap/EmojiNode";
import { createMentionNode } from "@/lib/tiptap/MentionNode";
import ReadOnlyCodeBlockNode from "@/lib/tiptap/ReadOnlyCodeBlockNode";
import ImageExtension from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  content: string;
  className?: string;
  highlightKeyword?: string;
  onMentionPreviewVisibleChange?: (visible: boolean) => void;
};

type MentionPreview = {
  publicId: string;
  name: string;
  image: string | null;
  rating: number;
};

type ActiveMention = {
  publicId: string;
  label: string;
  rect: DOMRect;
};

const PREVIEW_CARD_WIDTH = 200;
const PREVIEW_CARD_HEIGHT = 116;
const BRIDGE_PADDING = 6; // mentionとcardの間の余白

/**
 * 座標が矩形の中にあるかチェック（padding付き）
 */
function isInRect(
  x: number,
  y: number,
  rect: { left: number; top: number; right: number; bottom: number },
  pad = 0,
) {
  return (
    x >= rect.left - pad &&
    x <= rect.right + pad &&
    y >= rect.top - pad &&
    y <= rect.bottom + pad
  );
}

function isInMentionCardArea(
  x: number,
  y: number,
  mentionRect: DOMRect,
  cardRect: DOMRect | null,
) {
  const inMention = isInRect(x, y, mentionRect, 4);

  let inBridge = false;
  if (cardRect) {
    const bridgeLeft = Math.min(mentionRect.left, cardRect.left);
    const bridgeRight = Math.max(mentionRect.right, cardRect.right);
    const isCardBelow = cardRect.top > mentionRect.bottom;
    const isCardAbove = cardRect.bottom < mentionRect.top;

    if (isCardBelow) {
      inBridge = isInRect(x, y, {
        left: bridgeLeft,
        right: bridgeRight,
        top: mentionRect.bottom - BRIDGE_PADDING,
        bottom: cardRect.top + BRIDGE_PADDING,
      });
    } else if (isCardAbove) {
      inBridge = isInRect(x, y, {
        left: bridgeLeft,
        right: bridgeRight,
        top: cardRect.bottom - BRIDGE_PADDING,
        bottom: mentionRect.top + BRIDGE_PADDING,
      });
    }
  }

  const inCard = cardRect ? isInRect(x, y, cardRect, 4) : false;
  return inMention || inBridge || inCard;
}

export default function MessageContent({
  content,
  className,
  highlightKeyword,
  onMentionPreviewVisibleChange,
}: Props) {
  const router = useRouter();
  const [activeMention, setActiveMention] = useState<ActiveMention | null>(
    null,
  );
  const [preview, setPreview] = useState<MentionPreview | null>(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  const previewCacheRef = useRef<Map<string, MentionPreview>>(new Map());
  const hoverCardRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const disposeTimerRef = useRef<number | null>(null);
  const showFrameRef = useRef<number | null>(null);
  const activeMentionRef = useRef<ActiveMention | null>(null);
  const cardRectRef = useRef<DOMRect | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  // activeMentionをrefにも同期（pointermoveハンドラから参照するため）
  useEffect(() => {
    activeMentionRef.current = activeMention;
  }, [activeMention]);

  const clearTimers = useCallback(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (disposeTimerRef.current != null) {
      window.clearTimeout(disposeTimerRef.current);
      disposeTimerRef.current = null;
    }
  }, []);

  const clearShowFrame = useCallback(() => {
    if (showFrameRef.current != null) {
      window.cancelAnimationFrame(showFrameRef.current);
      showFrameRef.current = null;
    }
  }, []);

  const getFadeOutMs = useCallback(() => {
    const card = hoverCardRef.current;
    if (!card || typeof window === "undefined") return 180;
    const computed = window.getComputedStyle(card);
    const parse = (v: string) => {
      const s = v.trim();
      if (s.endsWith("ms")) return parseFloat(s) || 0;
      if (s.endsWith("s")) return (parseFloat(s) || 0) * 1000;
      return 0;
    };
    const durations = computed.transitionDuration.split(",").map(parse);
    const delays = computed.transitionDelay.split(",").map(parse);
    const max = Math.max(
      0,
      ...durations.map((d, i) => d + (delays[i] ?? delays[0] ?? 0)),
    );
    return Math.max(180, max + 20);
  }, []);

  const scheduleHide = useCallback(() => {
    clearTimers();
    clearShowFrame();
    hideTimerRef.current = window.setTimeout(() => {
      setIsPreviewVisible(false);
      disposeTimerRef.current = window.setTimeout(() => {
        setActiveMention(null);
        setPreview(null);
        cardRectRef.current = null;
      }, getFadeOutMs());
    }, 0);
  }, [clearTimers, clearShowFrame, getFadeOutMs]);

  const showPreview = useCallback(() => {
    clearTimers();
    clearShowFrame();
    setIsPreviewVisible(false);
    // 2フレーム待ってからvisibleにする（CSS transitionのため）
    showFrameRef.current = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setIsPreviewVisible(true);
      });
    });
  }, [clearTimers, clearShowFrame]);

  // ===== コア: document全体のpointermoveで座標ベース判定 =====
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onMove = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY };

      const mention = activeMentionRef.current;
      if (!mention) return;

      const { clientX: x, clientY: y } = e;
      const mRect = mention.rect;

      // cardのrectはhoverCardRefから取得（レンダリング後に最新を反映）
      const cardRect = hoverCardRef.current?.getBoundingClientRect() ?? null;
      if (cardRect) cardRectRef.current = cardRect;

      if (isInMentionCardArea(x, y, mRect, cardRect)) {
        clearTimers();
        // フェードインしていなければ表示
        setIsPreviewVisible((prev) => prev || true);
      } else {
        scheduleHide();
      }
    };

    document.addEventListener("pointermove", onMove);
    return () => document.removeEventListener("pointermove", onMove);
  }, [clearTimers, scheduleHide]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onScroll = () => {
      const mention = activeMentionRef.current;
      if (!mention) return;

      const point = pointerRef.current;
      if (!point) {
        scheduleHide();
        return;
      }

      let latestMentionRect = mention.rect;
      const root = containerRef.current;
      if (root) {
        const mentionElements = Array.from(
          root.querySelectorAll<HTMLElement>('[data-type="mention"][data-id]'),
        );
        const currentMentionEl =
          mentionElements.find((el) => el.dataset.id === mention.publicId) ??
          null;

        if (currentMentionEl) {
          latestMentionRect = currentMentionEl.getBoundingClientRect();
          setActiveMention((prev) =>
            prev && prev.publicId === mention.publicId
              ? { ...prev, rect: latestMentionRect }
              : prev,
          );
        }
      }

      const cardRect =
        hoverCardRef.current?.getBoundingClientRect() ?? cardRectRef.current;

      if (isInMentionCardArea(point.x, point.y, latestMentionRect, cardRect)) {
        clearTimers();
        return;
      }

      scheduleHide();
    };

    window.addEventListener("scroll", onScroll, {
      passive: true,
      capture: true,
    });
    return () => {
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [clearTimers, scheduleHide]);

  const loadMentionPreview = useCallback(
    async (publicId: string, fallbackLabel: string) => {
      const cached = previewCacheRef.current.get(publicId);
      if (cached) {
        setPreview(cached);
        return;
      }
      try {
        const res = await fetch(`/api/users/public/${publicId}/mini`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("failed");
        const data = (await res.json()) as MentionPreview;
        const safe: MentionPreview = {
          publicId,
          name: data.name || fallbackLabel,
          image: data.image ?? null,
          rating: Number.isFinite(data.rating) ? data.rating : 0,
        };
        previewCacheRef.current.set(publicId, safe);
        setPreview(safe);
      } catch {
        const fallback: MentionPreview = {
          publicId,
          name: fallbackLabel,
          image: null,
          rating: 0,
        };
        previewCacheRef.current.set(publicId, fallback);
        setPreview(fallback);
      }
    },
    [],
  );

  const openUserDetail = useCallback(
    (publicId: string) => {
      clearTimers();
      router.push(`/users/${publicId}`);
    },
    [clearTimers, router],
  );

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          codeBlock: false,
          link: {
            openOnClick: true,
            HTMLAttributes: {
              target: "_blank",
              rel: "noopener noreferrer",
              class: "text-link",
            },
          },
        }),
        ImageExtension,
        ReadOnlyCodeBlockNode,
        EmojiNode,
        Underline,
        createMentionNode({ className: "mentionNode mentionNodeInteractive" }),
      ],
      content,
      editable: false,
      immediatelyRender: false,
    },
    [content],
  );

  // mentionNodeへのpointerenter/clickだけをTipTap DOMで監視
  useEffect(() => {
    if (!editor) return;
    const root = editor.view?.dom as HTMLElement | undefined;
    if (!root) return;

    const getMention = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return null;
      return target.closest(
        '[data-type="mention"][data-id]',
      ) as HTMLElement | null;
    };

    const onPointerEnter = (e: PointerEvent) => {
      const el = getMention(e.target);
      if (!el) return;

      const publicId = el.dataset.id?.trim();
      if (!publicId) return;

      clearTimers();

      const label =
        el.dataset.label?.trim() ||
        (el.textContent || "").replace(/^@/, "").trim() ||
        publicId;

      const rect = el.getBoundingClientRect();
      setActiveMention({ publicId, label, rect });
      showPreview();
      void loadMentionPreview(publicId, label);
    };

    // rectを最新に保つ
    const onPointerMove = (e: PointerEvent) => {
      const el = getMention(e.target);
      if (!el) return;
      setActiveMention((prev) => {
        if (!prev || prev.publicId !== el.dataset.id?.trim()) return prev;
        return { ...prev, rect: el.getBoundingClientRect() };
      });
    };

    const onClick = (e: PointerEvent) => {
      const el = getMention(e.target);
      if (!el) return;
      const publicId = el.dataset.id?.trim();
      if (!publicId) return;
      e.preventDefault();
      e.stopPropagation();
      openUserDetail(publicId);
    };

    root.addEventListener("pointerenter", onPointerEnter, true);
    root.addEventListener("pointermove", onPointerMove, true);
    root.addEventListener("click", onClick);

    return () => {
      root.removeEventListener("pointerenter", onPointerEnter, true);
      root.removeEventListener("pointermove", onPointerMove, true);
      root.removeEventListener("click", onClick);
    };
  }, [editor, clearTimers, showPreview, loadMentionPreview, openUserDetail]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      clearTimers();
      clearShowFrame();
      onMentionPreviewVisibleChange?.(false);
    };
  }, [clearTimers, clearShowFrame, onMentionPreviewVisibleChange]);

  useEffect(() => {
    onMentionPreviewVisibleChange?.(isPreviewVisible);
  }, [isPreviewVisible, onMentionPreviewVisibleChange]);

  // ハイライト処理（変更なし）
  useEffect(() => {
    if (!editor) return;
    const term = highlightKeyword?.trim();
    if (typeof window === "undefined") return;
    const root = editor.view?.dom as HTMLElement | undefined;
    if (!root) return;

    root
      .querySelectorAll('mark[data-search-highlight="true"]')
      .forEach((el) => {
        const parent = el.parentNode;
        if (!parent) return;
        parent.replaceChild(document.createTextNode(el.textContent || ""), el);
        parent.normalize();
      });

    if (!term) return;

    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
    const lowerTerm = term.toLowerCase();

    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? "";
        if (!text.toLowerCase().includes(lowerTerm)) return;
        const frag = document.createDocumentFragment();
        let lastIndex = 0;
        regex.lastIndex = 0;
        const match: RegExpExecArray | null = regex.exec(text);
        while (match !== null) {
          const start = match.index;
          const end = start + match[0].length;
          if (start > lastIndex)
            frag.appendChild(
              document.createTextNode(text.slice(lastIndex, start)),
            );
          const mark = document.createElement("mark");
          mark.setAttribute("data-search-highlight", "true");
          mark.textContent = text.slice(start, end);
          frag.appendChild(mark);
          lastIndex = end;
        }
        if (lastIndex === 0) return;
        if (lastIndex < text.length)
          frag.appendChild(document.createTextNode(text.slice(lastIndex)));
        node.parentNode?.replaceChild(frag, node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.tagName === "SCRIPT" || el.tagName === "STYLE") return;
        if (el.getAttribute("data-type") === "emoji") return;
        Array.from(el.childNodes).forEach(walk);
      }
    };
    Array.from(root.childNodes).forEach(walk);
  }, [editor, highlightKeyword]);

  const previewPosition = useMemo(() => {
    if (
      !activeMention ||
      typeof window === "undefined" ||
      !containerRef.current
    ) {
      return null;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const padding = 8;
    const gap = 8;
    const maxLeft = window.innerWidth - PREVIEW_CARD_WIDTH - padding;
    const leftInViewport = Math.min(
      maxLeft,
      Math.max(padding, activeMention.rect.left),
    );
    const shouldPlaceAbove =
      activeMention.rect.bottom + gap + PREVIEW_CARD_HEIGHT >
      window.innerHeight - padding;
    const topInViewport = shouldPlaceAbove
      ? Math.max(padding, activeMention.rect.top - PREVIEW_CARD_HEIGHT - gap)
      : Math.min(
          window.innerHeight - PREVIEW_CARD_HEIGHT - padding,
          activeMention.rect.bottom + gap,
        );
    return {
      left: leftInViewport - containerRect.left,
      top: topInViewport - containerRect.top,
    };
  }, [activeMention]);

  if (!editor) return null;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <EditorContent editor={editor} className={className} />

      {activeMention && previewPosition && (
        <div
          ref={hoverCardRef}
          className={`mentionPreviewCard${isPreviewVisible ? " isVisible" : ""}`}
          style={{
            position: "absolute",
            left: `${previewPosition.left}px`,
            top: `${previewPosition.top}px`,
          }}
        >
          <button
            type="button"
            className="mentionPreviewMain"
            onClick={() => openUserDetail(activeMention.publicId)}
          >
            <Avatar
              src={preview?.image ?? null}
              alt={`${preview?.name ?? activeMention.label}さんのアイコン`}
              className="mentionPreviewAvatar"
            />
            <span className="mentionPreviewBody">
              <span className="mentionPreviewName">
                {preview?.name ?? activeMention.label}
              </span>
              <span className="mentionPreviewRating">
                <Rating value={preview?.rating ?? 0} />
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
