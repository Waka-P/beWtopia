"use client";

import { EditorContent, useCurrentEditor } from "@tiptap/react";
import styles from "./EditorBody.module.scss";

type Props = {
  textLength: number;
  maxContentLength: number;
};

export default function EditorBody({ textLength, maxContentLength }: Props) {
  const { editor } = useCurrentEditor();

  return (
    <>
      <EditorContent editor={editor} className={styles.editorContent} />

      {maxContentLength < textLength && (
        <div className={styles.charCounter}>
          {textLength} / {maxContentLength}
        </div>
      )}
    </>
  );
}
