import Image from "next/image";
import styles from "../sidebar.module.scss";

export default function ChatActive() {
  return (
    <Image
      className={styles.sidebarIcon}
      src="/icons/sidebar/chat-filled.png"
      alt="チャット"
      width={24}
      height={24}
    />
  );
}
