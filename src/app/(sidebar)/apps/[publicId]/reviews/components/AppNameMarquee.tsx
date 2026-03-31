"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";

type Props = {
  name: string;
  className: string;
  marqueeReadyClassName: string;
  marqueeTextClassName: string;
};

export default function AppNameMarquee({
  name,
  className,
  marqueeReadyClassName,
  marqueeTextClassName,
}: Props) {
  const appNameRef = useRef<HTMLParagraphElement | null>(null);
  const [overflow, setOverflow] = useState(0);

  useEffect(() => {
    const measure = () => {
      const titleEl = appNameRef.current;
      if (!titleEl) return;

      setOverflow(Math.max(titleEl.scrollWidth - titleEl.clientWidth, 0));
    };

    measure();
    window.addEventListener("resize", measure);

    return () => {
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <p
      ref={appNameRef}
      className={`${className} ${overflow > 0 ? marqueeReadyClassName : ""}`.trim()}
      style={
        {
          "--marquee-distance": `${overflow}px`,
        } as CSSProperties
      }
    >
      <span className={marqueeTextClassName}>{name}</span>
    </p>
  );
}
