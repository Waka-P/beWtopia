"use client";
import CodeBlockNode from "@/lib/tiptap/CodeBlockNode";
import { EmojiNode } from "@/lib/tiptap/EmojiNode";
import LinkBubble from "@/lib/tiptap/LinkBubble";
import LinkModal from "@/lib/tiptap/LinkModal";
import Toolbar from "@/lib/tiptap/Toolbar";
import { fetcher } from "@/utils/fetcher";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import Underline from "@tiptap/extension-underline";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, EditorContext, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import styles from "./BewtsMemoEditor.module.scss";
import MovablePopup from "./MovablePopup";

type Props = {
  roomId: string | number;
  userName: string;
  userColor?: string;
  nameMaxLength?: number;
  roomName?: string;
};

type AwarenessUser = { name?: string; color?: string } & Record<
  string,
  unknown
>;
type AwarenessState = { user?: AwarenessUser } | null;

type Collab = {
  ydoc: Y.Doc;
  provider: WebsocketProvider;
};

export default function BewtsMemoEditor({
  roomId,
  userName,
  userColor,
  nameMaxLength = 12,
  roomName,
}: Props) {
  const popupTitle = roomName ? `${roomName} - ビューズメモ` : "Memo";

  const displayName = useMemo(
    () =>
      userName.length > nameMaxLength
        ? userName.slice(0, nameMaxLength) + "…"
        : userName,
    [userName, nameMaxLength],
  );

  const assignedColor = useMemo(() => {
    if (userColor) return userColor;
    const palette = [
      "#e6194b",
      "#3cb44b",
      "#ffe119",
      "#4363d8",
      "#f58231",
      "#911eb4",
      "#46f0f0",
      "#f032e6",
      "#bcf60c",
      "#ef5454",
      "#008080",
      "#3d0261",
      "#9a6324",
      "#948805",
      "#800000",
      "#00912b",
      "#464600",
      "#c76300",
      "#000075",
      "#000000",
    ];
    let hash = 0;
    for (let i = 0; i < userName.length; i++) {
      hash = (hash * 31 + userName.charCodeAt(i)) % palette.length;
    }
    return palette[hash];
  }, [userName, userColor]);

  const [collab, setCollab] = useState<Collab | null>(null);
  const [loaded, setLoaded] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    const ydoc = new Y.Doc();

    const setup = async () => {
      try {
        const data = await fetcher<string>(`/api/bewts/memo/${roomId}`);
        const buf = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
        Y.applyUpdate(ydoc, buf);
      } catch (err: unknown) {
        const asObj = err as { status?: number; message?: string } | null;
        const status = asObj?.status ?? null;
        const msg = asObj?.message?.trim() ?? "";
        const isNotFound =
          status === 404 ||
          msg.startsWith("<!DOCTYPE") ||
          msg.startsWith("<html") ||
          msg.includes("<html");
        if (!isNotFound) {
          console.error("[memo editor] load initial data failed", err);
        }
      }

      if (!mounted) return;

      const wsUrl = process.env.NEXT_PUBLIC_YJS_WS ?? "ws://localhost:1234";
      let provider: WebsocketProvider;
      try {
        provider = new WebsocketProvider(wsUrl, `bewts-memo-${roomId}`, ydoc);
      } catch (e) {
        console.error("[memo editor] websocket creation failed", e);
        if (mounted) setLoaded(true);
        return;
      }

      provider.awareness.setLocalStateField("user", {
        name: displayName,
        color: assignedColor,
      });

      if (process.env.NODE_ENV !== "production") {
        provider.awareness.on("update", () => {
          const states = Array.from(
            provider.awareness.getStates().values(),
          ).filter(
            (s: AwarenessState) => s?.user && Object.keys(s.user).length > 0,
          );
          console.debug("[memo editor] awareness states", states);
        });
      }

      if (mounted) {
        setCollab({ ydoc, provider });
        setLoaded(true);
      }
    };

    setup();

    return () => {
      mounted = false;
      // setCollab(null) so the editor unmounts cleanly before we destroy the
      // provider. React will unmount CollaborationEditor (child) synchronously.
      setCollab(null);
      setLoaded(false);
      // We intentionally do NOT call ydoc.destroy() — see architecture notes.
    };
  }, [roomId, assignedColor, displayName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------
  // Autosave: attach to ydoc once collab is ready.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!collab) return;
    const { ydoc, provider } = collab;

    const scheduleSave = () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          const update = Y.encodeStateAsUpdate(ydoc);
          const b64 = btoa(String.fromCharCode(...update));
          await fetcher(`/api/bewts/memo/${roomId}`, {
            method: "POST",
            body: JSON.stringify({ yjsBase64: b64 }),
          });
        } catch (e) {
          console.error("[memo editor] save error", e);
        }
      }, 2000);
    };

    ydoc.on("update", scheduleSave);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      ydoc.off("update", scheduleSave);
      try {
        provider.awareness.setLocalStateField("user", null);
      } catch {}
      provider.destroy();
    };
  }, [collab, roomId]);

  // ------------------------------------------------------------------
  // Phase 2: render the editor only when the provider is live.
  // ------------------------------------------------------------------
  if (!loaded) return null;
  if (!collab) return null; // provider failed — could show an error state here

  return (
    <CollaborationEditor
      collab={collab}
      displayName={displayName}
      assignedColor={assignedColor}
      roomId={roomId}
      popupTitle={popupTitle}
    />
  );
}

// ------------------------------------------------------------------
// Inner component — receives a guaranteed-live collab pair.
// useEditor is called here so it always has a real provider.
// ------------------------------------------------------------------
function CollaborationEditor({
  collab,
  displayName,
  assignedColor,
  roomId,
  popupTitle,
}: {
  collab: Collab;
  displayName: string;
  assignedColor: string;
  roomId: string | number;
  popupTitle: string;
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [linkRange, setLinkRange] = useState<null | {
    from: number;
    to: number;
  }>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          protocols: ["http", "https"],
          HTMLAttributes: {
            class: "text-link",
            target: "_blank",
            rel: "noopener noreferrer nofollow",
          },
        },
      }),
      CodeBlockNode,
      Underline,
      EmojiNode,
      Placeholder.configure({ placeholder: "メモを入力…" }),
      Collaboration.configure({ document: collab.ydoc }),
      CollaborationCaret.configure({
        // provider is guaranteed non-null here — the parent only renders
        // this component after the provider is successfully created.
        provider: collab.provider,
        user: { name: displayName, color: assignedColor },
      }),
    ],
    immediatelyRender: false,
  });

  // Sync user info if name/colour changes after mount.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    try {
      editor.commands.updateUser({ name: displayName, color: assignedColor });
    } catch {}
    try {
      collab.provider.awareness.setLocalStateField("user", {
        name: displayName,
        color: assignedColor,
      });
    } catch {}
  }, [editor, displayName, assignedColor, collab.provider]);

  const openLinkModal = useCallback(() => {
    if (!editor) return;

    const { from, to } = editor.view.state.selection;

    // カーソルがリンク内にある場合の処理
    if (from === to && editor.isActive("link")) {
      editor.commands.extendMarkRange("link");
      const selection = editor.view.state.selection;
      const text = editor.state.doc.textBetween(
        selection.from,
        selection.to,
        "",
      );
      setLinkText(text);
      const prevUrl: string = editor.getAttributes("link").href;
      if (prevUrl) {
        setLinkUrl(prevUrl);
      }
      setLinkRange({ from: selection.from, to: selection.to });
      setShowLinkModal(true);
      return;
    }

    // 通常の選択範囲の処理
    // テキストコンテンツの実際の長さを取得
    const fullText = editor.getText();
    const selectedText = editor.state.doc.textBetween(from, to, "");

    console.log("fullText:", fullText, "length:", fullText.length);
    console.log("selectedText:", selectedText, "length:", selectedText.length);
    console.log("original from:", from, "to:", to);

    // 全選択の場合（選択テキストがドキュメント全体と一致）
    let actualFrom = from;
    let actualTo = to;

    if (selectedText === fullText && to - from > fullText.length) {
      // 段落の境界を除外
      actualFrom = from + 1;
      actualTo = to - 1;
      console.log(
        "Adjusted for full selection - from:",
        actualFrom,
        "to:",
        actualTo,
      );
    }

    const text = editor.state.doc.textBetween(actualFrom, actualTo, "");
    setLinkText(text);
    const prevUrl: string = editor.getAttributes("link").href;
    if (prevUrl) {
      setLinkUrl(prevUrl);
    }

    setLinkRange({ from: actualFrom, to: actualTo });
    setShowLinkModal(true);
  }, [editor]);

  const closeLinkModal = useCallback(() => {
    if (!editor) return;
    setShowLinkModal(false);
    setLinkUrl("");
    setLinkText("");
    setLinkRange(null);
    editor.commands.focus();
  }, [editor]);

  const saveLink = useCallback(() => {
    if (!editor) return;

    if (!linkUrl) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      closeLinkModal();
      return;
    }

    const isLink: RegExp = /(https?:\/\/|mailto:|ftp:\/\/)/;
    const href = isLink.test(linkUrl) ? linkUrl : `https://${linkUrl}`;

    const { view } = editor;
    const selFrom = linkRange ? linkRange.from : view.state.selection.from;
    const selTo = linkRange ? linkRange.to : view.state.selection.to;

    if (selTo > selFrom) {
      if (linkText && linkText.length > 0) {
        editor
          .chain()
          .focus()
          .setTextSelection({ from: selFrom, to: selTo })
          .deleteSelection()
          .insertContent(linkText)
          .setTextSelection({ from: selFrom, to: selFrom + linkText.length })
          .setLink({ href })
          .run();
      } else {
        editor
          .chain()
          .focus()
          .setTextSelection({ from: selFrom, to: selTo })
          .setLink({ href })
          .run();
      }

      closeLinkModal();
      setLinkRange(null);
      return;
    }

    const insertedText = linkText && linkText.length > 0 ? linkText : href;

    editor
      .chain()
      .focus()
      .insertContent(insertedText)
      .setTextSelection({ from: selFrom, to: selFrom + insertedText.length })
      .setLink({ href })
      .run();

    closeLinkModal();
    setLinkRange(null);
  }, [editor, linkUrl, linkText, closeLinkModal, linkRange]);

  const removeLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    closeLinkModal();
  }, [editor, closeLinkModal]);

  if (!editor) return null;

  return (
    <MovablePopup
      title={popupTitle}
      onClose={() => {
        window.dispatchEvent(
          new CustomEvent("bewts:memo:close", { detail: { roomId } }),
        );
      }}
    >
      <EditorContext.Provider value={{ editor }}>
        <Toolbar
          wysiwygVisible={true}
          showEmojiPicker={showEmojiPicker}
          setShowEmojiPicker={setShowEmojiPicker}
          openLinkModal={openLinkModal}
        />

        <div className={styles.editorContent}>
          <EditorContent editor={editor} />
        </div>

        <LinkBubble openLinkModal={openLinkModal} removeLink={removeLink} />
        <LinkModal
          open={showLinkModal}
          onOpen={setShowLinkModal}
          linkText={linkText}
          setLinkText={setLinkText}
          linkUrl={linkUrl}
          setLinkUrl={setLinkUrl}
          closeLinkModal={closeLinkModal}
          saveLink={saveLink}
        />
      </EditorContext.Provider>
    </MovablePopup>
  );
}
