import Image from "next/image";
import styles from "../sidebar.module.scss";

export default function SearchActive() {
  return (
    <Image
      className={styles.sidebarIcon}
      src="/icons/sidebar/search-filled.png"
      alt="検索"
      width={24}
      height={24}
    />
  );
}
