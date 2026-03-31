import { useCurrentEditor, useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import styles from "./LinkBubble.module.scss";

export default function LinkBubble({
  openLinkModal,
  removeLink,
}: {
  openLinkModal: () => void;
  removeLink: () => void;
}) {
  const { editor } = useCurrentEditor();

  const linkHref = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return "";
      const attrs = editor.getAttributes("link");
      return attrs.href || "";
    },
  });

  if (!editor) return null;

  return (
    <BubbleMenu
      className={styles.bubbleMenu}
      editor={editor}
      options={{ offset: 6, placement: "top", strategy: "fixed" }}
      shouldShow={({ editor, from, to }) => {
        const isLink = editor.isActive("link");
        const hasHref = !!editor.getAttributes("link").href;
        const hasSelection = from !== to;
        return isLink && hasHref && !hasSelection;
      }}
    >
      <h3 className={styles.title}>リンクを編集</h3>
      <a
        className={styles.link}
        href={linkHref}
        target="_blank"
        rel="noopener noreferrer"
      >
        {linkHref}
      </a>
      <div className={styles.footer}>
        <button
          onClick={openLinkModal}
          type="button"
          className={styles.editButton}
        >
          編集
        </button>
        <button
          onClick={removeLink}
          type="button"
          className={styles.deleteButton}
        >
          削除する
        </button>
      </div>
    </BubbleMenu>
  );
}
