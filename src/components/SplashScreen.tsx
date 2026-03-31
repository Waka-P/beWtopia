"use client";

import styles from "@/components/splash.module.scss";
import { cn } from "@/lib/cn";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

const SPLASH_HIDDEN_EVENT = "bewtopia:splashHidden";

function notifySplashHidden() {
  if (typeof window === "undefined") return;
  (
    window as Window & { __bewtopiaSplashHidden?: boolean }
  ).__bewtopiaSplashHidden = true;
  window.dispatchEvent(new Event(SPLASH_HIDDEN_EVENT));
}

export default function SplashScreen({ show }: { show: boolean }) {
  const [hidden, setHidden] = useState(false);
  const [startY, setStartY] = useState<number | null>(null);

  const hideSplash = useCallback(() => {
    setHidden(true);
    notifySplashHidden();
  }, []);
  const active = show && !hidden;

  useEffect(() => {
    if (!active) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") hideSplash();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [hideSplash, active]);

  useEffect(() => {
    if (!active) return;
    const handleClick = () => hideSplash();
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [hideSplash, active]);

  useEffect(() => {
    if (!active) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY < 40) hideSplash();
    };
    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [hideSplash, active]);

  useEffect(() => {
    if (!active) return;
    const handleTouchStart = (e: TouchEvent) => setStartY(e.touches[0].clientY);
    const handleTouchMove = (e: TouchEvent) => {
      if (startY !== null && startY - e.touches[0].clientY > 80) hideSplash();
    };
    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("touchmove", handleTouchMove);
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [hideSplash, startY, active]);

  // スプラッシュ自体が表示されない場合（show=false）のときも、「既に閉じた」ことを通知する
  useEffect(() => {
    if (!show) {
      notifySplashHidden();
    }
  }, [show]);

  if (!show) return null;

  return (
    <div className={cn(styles.container, hidden && styles.hidden)}>
      <Image
        className={styles.logo}
        src="/images/beWtopia.png"
        width={2072}
        height={494}
        alt="beWtopia"
      />
    </div>
  );
}
