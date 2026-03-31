"use client";

import EmojiPicker from "@/app/(sidebar)/components/EmojiPicker";
import { cn } from "@/lib/cn";
import { emojiToUnified } from "@/utils/emoji";
import { useCurrentEditor } from "@tiptap/react";
import { useRef } from "react";
import {
  MdCode,
  MdEmojiEmotions,
  MdFormatBold,
  MdFormatItalic,
  MdFormatListBulleted,
  MdFormatListNumbered,
  MdFormatQuote,
  MdFormatStrikethrough,
  MdFormatUnderlined,
  MdHorizontalRule,
  MdInsertLink,
  MdRedo,
  MdTerminal,
  MdUndo,
} from "react-icons/md";
import styles from "./Toolbar.module.scss";

type Props = {
  wysiwygVisible: boolean;
  showEmojiPicker: boolean;
  setShowEmojiPicker: (v: boolean) => void;
  openLinkModal: () => void;
};

export default function Toolbar({
  wysiwygVisible,
  showEmojiPicker,
  setShowEmojiPicker,
  openLinkModal,
}: Props) {
  const { editor } = useCurrentEditor();
  const emojiButtonRef = useRef<HTMLButtonElement | null>(null);

  return (
    <div
      className={cn(
        styles.toolbar,
        wysiwygVisible ? styles.toolbarOpen : styles.toolbarClosed,
      )}
    >
      <button
        type="button"
        onClick={() => editor?.chain().focus().toggleBold().run()}
        title="太字"
        className={styles.toolbarBtn}
      >
        <MdFormatBold size={20} />
      </button>
      <button
        type="button"
        onClick={() => editor?.chain().focus().toggleItalic().run()}
        title="イタリック"
        className={styles.toolbarBtn}
      >
        <MdFormatItalic size={20} />
      </button>
      <button
        type="button"
        onClick={() => editor?.chain().focus().toggleStrike().run()}
        title="取り消し線"
        className={styles.toolbarBtn}
      >
        <MdFormatStrikethrough size={20} />
      </button>
      <button
        type="button"
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
        title="下線"
        className={styles.toolbarBtn}
      >
        <MdFormatUnderlined size={20} />
      </button>
      <div className={styles.divider} />
      <button
        type="button"
        onClick={openLinkModal}
        title="リンク"
        className={styles.toolbarBtn}
      >
        <MdInsertLink size={20} />
      </button>

      <div className={styles.divider} />
      <button
        type="button"
        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        title="絵文字"
        className={styles.toolbarBtn}
        ref={emojiButtonRef}
      >
        <MdEmojiEmotions size={18} />
      </button>
      <EmojiPicker
        open={showEmojiPicker}
        anchorRef={emojiButtonRef}
        onEmojiClick={(data) => {
          const emoji = data.emoji;
          console.log(emojiToUnified(emoji));
          editor?.chain().insertEmoji(emoji).focus().run();
        }}
        onClose={() => setShowEmojiPicker(false)}
        placement="top-start"
      />

      <div className={styles.divider} />
      <button
        type="button"
        onClick={() => editor?.chain().focus().toggleCode().run()}
        title="インラインコード"
        className={styles.toolbarBtn}
      >
        <MdCode size={20} />
      </button>
      <button
        type="button"
        onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
        title="コードブロック"
        className={styles.toolbarBtn}
      >
        <MdTerminal size={20} />
      </button>
      <button
        type="button"
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        title="引用"
        className={styles.toolbarBtn}
      >
        <MdFormatQuote size={20} />
      </button>

      <div className={styles.divider} />
      <button
        type="button"
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
        title="箇条書き"
        className={styles.toolbarBtn}
      >
        <MdFormatListBulleted size={20} />
      </button>
      <button
        type="button"
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        title="番号付きリスト"
        className={styles.toolbarBtn}
      >
        <MdFormatListNumbered size={20} />
      </button>
      <button
        type="button"
        onClick={() => editor?.chain().focus().setHorizontalRule().run()}
        title="区切り線"
        className={styles.toolbarBtn}
      >
        <MdHorizontalRule size={20} />
      </button>

      <div className={styles.divider} />
      <button
        type="button"
        onClick={() => editor?.chain().focus().undo().run()}
        title="元に戻す"
        className={styles.toolbarBtn}
      >
        <MdUndo size={20} />
      </button>
      <button
        type="button"
        onClick={() => editor?.chain().focus().redo().run()}
        title="やり直す"
        className={styles.toolbarBtn}
      >
        <MdRedo size={20} />
      </button>
    </div>
  );
}
