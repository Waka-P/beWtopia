import { Modal } from "@/components/Modal";
import styles from "./LinkModal.module.scss";

export default function LinkModal({
  open,
  onOpen,
  linkText,
  setLinkText,
  linkUrl,
  setLinkUrl,
  closeLinkModal,
  saveLink,
}: {
  open: boolean;
  onOpen: (open: boolean) => void;
  linkText: string;
  setLinkText: (text: string) => void;
  linkUrl: string;
  setLinkUrl: (url: string) => void;
  closeLinkModal: () => void;
  saveLink: () => void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpen}
      title="リンクを追加する"
      description="テキストにリンクを追加します。"
      footer={
        <>
          <button
            type="button"
            onClick={closeLinkModal}
            className={styles.cancelBtn}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={saveLink}
            className={styles.addLinkBtn}
          >
            保存する
          </button>
        </>
      }
    >
      <div className={styles.formGroup}>
        <label htmlFor="text" className={styles.label}>
          テキスト
        </label>
        <input
          type="text"
          id="text"
          placeholder=""
          autoComplete="off"
          value={linkText}
          onChange={(e) => setLinkText(e.target.value)}
          className={styles.input}
        />
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="url" className={styles.label}>
          リンク
        </label>
        <input
          type="url"
          id="url"
          placeholder=""
          autoComplete="off"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          className={styles.input}
        />
      </div>
    </Modal>
  );
}
