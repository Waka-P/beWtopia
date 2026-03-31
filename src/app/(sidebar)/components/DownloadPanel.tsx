"use client";
import Image from "next/image";
import { useDownload } from "../contexts/DownloadContext";
import styles from "./DownloadPanel.module.scss";

export const DownloadPanel = () => {
  const { items, startDownload, startAll } = useDownload();

  if (items.length === 0) return null;

  const singleMode = items.length === 1;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>ダウンロード ({items.length})</div>

      <div className={styles.list}>
        {items.map((item) => (
          <div key={item.id} className={styles.row}>
            <div>
              <div className={styles.appName}>{item.name}</div>
              {item.status === "failed" && item.error && (
                <div
                  style={{ color: "#c00", fontSize: 12, marginTop: 4 }}
                  title={item.error}
                >
                  {item.error.length > 120
                    ? `${item.error.slice(0, 120)}...`
                    : item.error}
                </div>
              )}
            </div>

            {!singleMode && (
              <button
                type="button"
                onClick={() => startDownload(item.id)}
                className={styles.downloadBtn}
              >
                {item.status === "failed" ? (
                  <Image
                    src="/images/reset.png"
                    className={styles.downloadBtnIcon}
                    alt="再試行"
                    width={96}
                    height={96}
                  />
                ) : (
                  <Image
                    src="/images/download.png"
                    className={styles.downloadBtnIcon}
                    alt="ダウンロード"
                    width={663}
                    height={615}
                  />
                )}
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        className={styles.allBtn}
        onClick={() => {
          if (singleMode) startDownload(items[0].id);
          else startAll();
        }}
      >
        {singleMode ? "ダウンロード" : "すべてダウンロード"}
      </button>
    </div>
  );
};
