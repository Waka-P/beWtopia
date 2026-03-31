import SidebarToggle from "@/app/(sidebar)/components/SidebarToggle";
import toggleStyles from "@/app/(sidebar)/components/SidebarToggle.module.scss";
import type { NotificationSettings } from "../notificationSettings";
import styles from "../page.module.scss";

type Props = {
  settings: NotificationSettings;
  onToggle: (key: keyof NotificationSettings) => void;
  items: NotificationSettingItem[];
};

export type NotificationSettingItem = {
  key: keyof NotificationSettings;
  id: string;
  label: string;
  desc: string;
};

export default function NotificationSettingsPanel({
  settings,
  onToggle,
  items,
}: Props) {
  return (
    <div className={styles.notificationSettingsPanel}>
      {items.map((item) => (
        <div key={item.key} className={styles.notificationSettingRow}>
          <div>
            <div className={styles.notificationSettingLabel}>{item.label}</div>
            <div className={styles.notificationSettingDesc}>{item.desc}</div>
          </div>
          <SidebarToggle
            id={item.id}
            checked={settings[item.key]}
            onChange={() => onToggle(item.key)}
            inputClassName={toggleStyles.toggleInput}
            toggleClassName={toggleStyles.toggle}
            knobClassName={toggleStyles.knob}
          />
        </div>
      ))}
    </div>
  );
}
