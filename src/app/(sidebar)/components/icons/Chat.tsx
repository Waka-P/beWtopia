import Image from "next/image";
import styles from "../sidebar.module.scss";

export default function Chat() {
  return (
    <Image
      className={styles.sidebarIcon}
      src="/icons/sidebar/chat-outlined.png"
      alt="チャット"
      width={24}
      height={24}
    />
  );
}
