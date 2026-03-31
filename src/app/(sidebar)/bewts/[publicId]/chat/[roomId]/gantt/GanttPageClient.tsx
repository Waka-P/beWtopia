"use client";

import Link from "next/link";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { GanttChart } from "../../components/gantt/GanttChart";
import styles from "./GanttPage.module.scss";

type Props = {
  project: { id: number; publicId: string; name: string };
  room: { id: number; name: string; isAllRoom: boolean };
  roles: { id: number; name: string; userIds: number[] }[];
  isAdmin: boolean;
};

export function GanttPageClient({ project, room, roles }: Props) {
  const roomLabel = room.isAllRoom ? "全体チャット" : room.name;
  const projectNameRef = useRef<HTMLAnchorElement | null>(null);
  const [projectNameOverflow, setProjectNameOverflow] = useState(0);

  useEffect(() => {
    const measure = () => {
      const titleEl = projectNameRef.current;
      if (!titleEl) return;

      setProjectNameOverflow(
        Math.max(titleEl.scrollWidth - titleEl.clientWidth, 0),
      );
    };

    measure();
    window.addEventListener("resize", measure);

    return () => {
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div className={styles.wrapper}>
      {/* ヘッダー */}
      <header className={styles.header}>
        <div className={styles.breadcrumb}>
          <Link
            ref={projectNameRef}
            href={`/bewts/${project.publicId}`}
            className={`${styles.breadcrumbLink} ${styles.projectLink} ${projectNameOverflow > 0 ? styles.marqueeReady : ""}`.trim()}
            style={
              {
                "--marquee-distance": `${projectNameOverflow}px`,
              } as CSSProperties
            }
          >
            <span className={styles.marqueeText}>{project.name}</span>
          </Link>
          <span className={styles.breadcrumbSep}>&gt;</span>
          <Link
            href={`/bewts/${project.publicId}/chat`}
            className={styles.breadcrumbLink}
          >
            チャット
          </Link>
          <span className={styles.breadcrumbSep}>&gt;</span>
          <span className={styles.breadcrumbCurrent}>
            {roomLabel} — ガントチャート
          </span>
        </div>
      </header>

      {/* ガントチャート本体 */}
      <div className={styles.body}>
        <GanttChart roomId={room.id} isAllRoom={room.isAllRoom} roles={roles} />
      </div>
    </div>
  );
}
