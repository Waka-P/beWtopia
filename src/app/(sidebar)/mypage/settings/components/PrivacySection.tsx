"use client";

import SettingsToggle from "./SettingsToggle";
import styles from "./PrivacySection.module.scss";

export type PrivacyState = {
  follow: boolean;
  order: boolean;
  scout: boolean;
  tip: boolean;
  showUserList: boolean;
};

type PrivacySectionProps = {
  privacy: PrivacyState;
  onToggle: (key: keyof PrivacyState) => void;
};

export default function PrivacySection({
  privacy,
  onToggle,
}: PrivacySectionProps) {
  return (
    <div className={styles.privacyOptions}>
      <SettingsToggle
        id="privacy-follow"
        label="フォロー"
        checked={privacy.follow}
        onChange={() => onToggle("follow")}
      />

      <SettingsToggle
        id="privacy-order"
        label="オーダー"
        checked={privacy.order}
        onChange={() => onToggle("order")}
      />

      <SettingsToggle
        id="privacy-scout"
        label="スカウト"
        checked={privacy.scout}
        onChange={() => onToggle("scout")}
      />

      <SettingsToggle
        id="privacy-tip"
        label="投げ銭"
        checked={privacy.tip}
        onChange={() => onToggle("tip")}
      />

      <SettingsToggle
        id="privacy-userlist"
        label="ユーザ一覧への表示"
        checked={privacy.showUserList}
        onChange={() => onToggle("showUserList")}
      />
    </div>
  );
}
