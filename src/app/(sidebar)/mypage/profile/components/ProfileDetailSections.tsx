"use client";

import JobPicker from "@/app/(sidebar)/components/JobPicker";
import Image from "next/image";
import { FaPlus } from "react-icons/fa6";
import styles from "../page.module.scss";
import type { JobOption } from "../types";

type ProfileDetailSectionsProps = {
  editing: boolean;
  occupation: string;
  jobOptions: JobOption[];
  achievements: string;
  externalLinks: string[];
  selfIntro: string;
  onAchievementsChange: (value: string) => void;
  onLinkChange: (index: number, value: string) => void;
  onAddLink: () => void;
  onRemoveLink: (index: number) => void;
  onSelfIntroChange: (value: string) => void;
};

export function ProfileDetailSections({
  editing,
  occupation,
  jobOptions,
  achievements,
  externalLinks,
  selfIntro,
  onAchievementsChange,
  onLinkChange,
  onAddLink,
  onRemoveLink,
  onSelfIntroChange,
}: ProfileDetailSectionsProps) {
  const filteredLinks = externalLinks.filter((l) => l.trim().length > 0);

  const rowClassName = editing
    ? `${styles.formRow} ${styles.formRowColumn}`
    : styles.formRow;

  return (
    <div className={styles.formSection}>
      <div className={rowClassName}>
        <div className={styles.formLabel}>職業</div>
        <div className={styles.formControl}>
          {editing ? (
            <JobPicker
              jobsFieldName="jobIds"
              jobs={jobOptions.map((job) => ({
                id: job.id,
                name: job.name,
              }))}
            />
          ) : (
            <div className={styles.viewText}>{occupation || "-"}</div>
          )}
        </div>
      </div>

      <div className={rowClassName}>
        <div className={styles.formLabel}>実績</div>
        <div className={styles.formControl}>
          {editing ? (
            <textarea
              className={styles.textarea}
              placeholder="受賞歴や開発実績などを記入してください。"
              value={achievements}
              onChange={(e) => onAchievementsChange(e.target.value)}
            />
          ) : (
            <div className={styles.viewText}>
              <p className={styles.multiLineText}>
                {achievements || "登録されていません"}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className={rowClassName}>
        <div className={styles.formLabel}>外部リンク</div>
        <div className={styles.formControl}>
          {editing ? (
            <div className={styles.linksEdit}>
              {externalLinks.map((link, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: 入力中の行ごとに安定したIDを持たないためインデックスキーを許容
                <div key={index} className={styles.linkRow}>
                  <input
                    className={styles.input}
                    type="url"
                    placeholder="例）https://example.com/portfolio"
                    value={link}
                    onChange={(e) => onLinkChange(index, e.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.removeLinkBtn}
                    disabled={externalLinks.length === 1}
                    onClick={() => onRemoveLink(index)}
                  >
                    <Image
                      src="/images/delete.png"
                      alt="削除"
                      width={16}
                      height={16}
                    />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={styles.addLinkBtn}
                onClick={onAddLink}
              >
                <FaPlus />
                リンクを追加
              </button>
            </div>
          ) : filteredLinks.length > 0 ? (
            <ul className={styles.linksList}>
              {filteredLinks.map((link) => (
                <li key={link} className={styles.linkItem}>
                  <a href={link} target="_blank" rel="noopener noreferrer">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.viewText}>登録されていません</div>
          )}
        </div>
      </div>

      <div className={rowClassName}>
        <div className={styles.formLabel}>自己紹介</div>
        <div className={styles.formControl}>
          {editing ? (
            <textarea
              className={styles.textarea}
              placeholder="自己紹介文を入力してください。"
              value={selfIntro}
              onChange={(e) => onSelfIntroChange(e.target.value)}
            />
          ) : (
            <div className={styles.viewText}>
              <p className={styles.multiLineText}>
                {selfIntro || "自己紹介はまだ登録されていません。"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
