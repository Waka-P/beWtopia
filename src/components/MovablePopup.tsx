"use client";
import { cn } from "@/lib/cn";
import Image from "next/image";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import styles from "./MovablePopup.module.scss";

type Props = {
  children: React.ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
  title?: string;
  onClose?: () => void;
};

export default function MovablePopup({
  children,
  defaultWidth = 600,
  defaultHeight = 400,
  title,
  onClose,
}: Props) {
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [size, setSize] = useState({ w: defaultWidth, h: defaultHeight });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  // state used to drive a quick fade/scale animation when the popup first
  // appears. this mirrors the behaviour of <Modal> so the memo window doesn’t
  // just pop onto the screen abruptly.
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  // trigger animation on mount
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // when we start closing, wait for the CSS transition then call the
  // provided callback so parent can actually unmount us. this keeps the
  // popup visible while the fade/scale animation plays out.
  useEffect(() => {
    if (!closing) return;
    const tid = window.setTimeout(() => {
      onClose?.();
    }, 300);
    return () => window.clearTimeout(tid);
  }, [closing, onClose]);

  const MIN_W = 400;
  const MIN_H = 270;

  const ref = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<{
    mx: number;
    my: number;
    x: number;
    y: number;
    w: number;
    h: number;
    dir?: string;
    aspect?: number;
  } | null>(null);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (dragging && startRef.current) {
        setPos({
          x: startRef.current.x + e.clientX - startRef.current.mx,
          y: startRef.current.y + e.clientY - startRef.current.my,
        });
      }
      if (resizing && startRef.current) {
        const s = startRef.current;
        const dx = e.clientX - s.mx;
        const dy = e.clientY - s.my;
        let newX = s.x;
        let newY = s.y;
        let newW = s.w;
        let newH = s.h;

        switch (s.dir) {
          case "e":
            newW = Math.max(MIN_W, Math.round(s.w + dx));
            break;
          case "w":
            newW = Math.max(MIN_W, Math.round(s.w - dx));
            newX = Math.round(s.x + dx);
            break;
          case "s":
            newH = Math.max(MIN_H, Math.round(s.h + dy));
            break;
          case "n":
            newH = Math.max(MIN_H, Math.round(s.h - dy));
            newY = Math.round(s.y + dy);
            break;
          case "se": {
            // free-form: change width and height independently
            newW = Math.max(MIN_W, Math.round(s.w + dx));
            newH = Math.max(MIN_H, Math.round(s.h + dy));
            break;
          }
          case "sw": {
            newW = Math.max(MIN_W, Math.round(s.w - dx));
            newX = Math.round(s.x + dx);
            newH = Math.max(MIN_H, Math.round(s.h + dy));
            break;
          }
          case "ne": {
            newW = Math.max(MIN_W, Math.round(s.w + dx));
            newH = Math.max(MIN_H, Math.round(s.h - dy));
            newY = Math.round(s.y + dy);
            break;
          }
          case "nw": {
            newW = Math.max(MIN_W, Math.round(s.w - dx));
            newX = Math.round(s.x + dx);
            newH = Math.max(MIN_H, Math.round(s.h - dy));
            newY = Math.round(s.y + dy);
            break;
          }
          default:
            newW = Math.max(MIN_W, Math.round(s.w + dx));
            newH = Math.max(MIN_H, Math.round(s.h + dy));
        }

        setPos({ x: newX, y: newY });
        setSize({ w: newW, h: newH });
      }
    }

    function onUp() {
      setDragging(false);
      setResizing(false);
      startRef.current = null;
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, resizing]);

  function onDragStart(e: React.MouseEvent) {
    setDragging(true);
    startRef.current = {
      mx: e.clientX,
      my: e.clientY,
      x: pos.x,
      y: pos.y,
      w: size.w,
      h: size.h,
      aspect: size.w / size.h,
    };
  }

  function onResizeStart(e: React.MouseEvent, dir: string) {
    e.stopPropagation();
    setResizing(true);
    startRef.current = {
      mx: e.clientX,
      my: e.clientY,
      x: pos.x,
      y: pos.y,
      w: size.w,
      h: size.h,
      dir,
      aspect: size.w / size.h,
    };
  }

  return (
    <div
      ref={ref}
      style={{
        left: fullscreen ? 0 : pos.x,
        top: fullscreen ? 0 : pos.y,
        maxWidth: fullscreen ? "100%" : size.w,
        maxHeight: fullscreen ? "100%" : size.h,
      }}
      className={cn(
        styles.popup,
        visible && styles.visible,
        (dragging || resizing) && styles.noWidthAndHeightTransition,
      )}
    >
      {/* biome-ignore lint: ドラッグ可能要素にdivを使用 */}
      <div onMouseDown={onDragStart} className={styles.header}>
        <div className={styles.headerTitle}>{title ?? "Memo"}</div>
        <div className={styles.headerButtons}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFullscreen((s) => !s);
            }}
            aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? (
              <Image
                src="/images/fullscreen-exit.png"
                alt="全画面表示を解除する"
                width={434}
                height={427}
                className={styles.headerIcon}
              />
            ) : (
              <Image
                src="/images/fullscreen.png"
                alt="全画面表示する"
                width={463}
                height={463}
                className={styles.headerIcon}
              />
            )}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              // trigger closing animation, parent will be notified after
              // transition finishes via effect above
              setVisible(false);
              setClosing(true);
            }}
            aria-label="Close"
          >
            <Image
              src="/images/cross.png"
              alt="閉じる"
              width={439}
              height={439}
              className={styles.headerIcon}
            />
          </button>
        </div>
      </div>
      <div className={styles.content}>{children}</div>
      {!fullscreen && (
        <>
          {/* Corners */}
          {/* biome-ignore lint: ドラッグ可能要素にdivを使用 */}
          <div
            onMouseDown={(e) => onResizeStart(e, "nw")}
            className={styles.resizeHandleNW}
          />
          {/* biome-ignore lint: ドラッグ可能要素にdivを使用 */}
          <div
            onMouseDown={(e) => onResizeStart(e, "ne")}
            className={styles.resizeHandleNE}
          />
          {/* biome-ignore lint: ドラッグ可能要素にdivを使用 */}
          <div
            onMouseDown={(e) => onResizeStart(e, "sw")}
            className={styles.resizeHandleSW}
          />
          {/* biome-ignore lint: ドラッグ可能要素にdivを使用 */}
          <div
            onMouseDown={(e) => onResizeStart(e, "se")}
            className={styles.resizeHandleSE}
          />

          {/* Edges */}
          {/* biome-ignore lint: ドラッグ可能要素にdivを使用 */}
          <div
            onMouseDown={(e) => onResizeStart(e, "n")}
            className={styles.resizeHandleN}
          />
          {/* biome-ignore lint: ドラッグ可能要素にdivを使用 */}
          <div
            onMouseDown={(e) => onResizeStart(e, "s")}
            className={styles.resizeHandleS}
          />
          {/* biome-ignore lint: ドラッグ可能要素にdivを使用 */}
          <div
            onMouseDown={(e) => onResizeStart(e, "w")}
            className={styles.resizeHandleW}
          />
          {/* biome-ignore lint: ドラッグ可能要素にdivを使用 */}
          <div
            onMouseDown={(e) => onResizeStart(e, "e")}
            className={styles.resizeHandleE}
          />
        </>
      )}
    </div>
  );
}
