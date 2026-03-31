"use client";

import type { RefObject } from "react";
import styles from "../page.module.scss";
import type { AppDetail } from "./types";
import { cn } from "@/lib/cn";

type Props = {
  app: AppDetail;
  descRef: RefObject<HTMLParagraphElement | null>;
  descExpanded: boolean;
  showToggle: boolean;
  onToggleDescription: () => void;
};

export function DescriptionSection({
  app,
  descRef,
  descExpanded,
  showToggle,
  onToggleDescription,
}: Props) {
  return (
    <section className={styles.descriptionSection}>
      <p
        ref={descRef}
        className={cn(
          styles.descriptionText,
          descExpanded && styles.descriptionExpanded,
        )}
      >
        {app.description.split(/\n/g).map((line, index, arr) => (
          // biome-ignore lint: indexの順序が変わらないためkeyとして使用
          <span key={index}>
            {line}
            {index < arr.length - 1 && <br />}
          </span>
        ))}
      </p>
      {showToggle && (
        <button
          className={styles.showMore}
          type="button"
          onClick={onToggleDescription}
        >
          {descExpanded ? "閉じる" : "すべて表示"}
        </button>
      )}
      {app.tags && app.tags.length > 0 && (
        <div className={styles.tagsRow}>
          {app.tags.map((appTag) => (
            <span key={appTag.tag.id} className={styles.tag}>
              {appTag.tag.name}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
