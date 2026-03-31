"use client";

import { MESSAGE_CONSTRAINTS, validateFile } from "@/app/schemas/chat";
import { cn } from "@/lib/cn";
import CodeBlockNode from "@/lib/tiptap/CodeBlockNode";
import { EmojiNode } from "@/lib/tiptap/EmojiNode";
import LinkBubble from "@/lib/tiptap/LinkBubble";
import LinkModal from "@/lib/tiptap/LinkModal";
import {
  createMentionNode,
  createMentionSuggestion,
  type MentionSuggestionUser,
} from "@/lib/tiptap/MentionNode";
import Toolbar from "@/lib/tiptap/Toolbar";
import type { Editor } from "@tiptap/core";
import Underline from "@tiptap/extension-underline";
import { Placeholder } from "@tiptap/extensions";
import {
  EditorContext,
  useCurrentEditor,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import "highlight.js/styles/github-dark.min.css";
import Image from "next/image";
import type React from "react";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { MdAttachFile, MdFormatBold } from "react-icons/md";
import Attachments from "./Attachments";
import EditorBody from "./EditorBody";
import styles from "./index.module.scss";

// Setup lowlight

type ImperativeEditor = {
  getHTML: () => string;
  getText: () => string;
  clearContent: () => void;
  setContent: (html: string) => void;
  focus: () => void;
};

type Attachment = {
  id: number | string;
  url: string;
  type: string;
  name?: string | null;
  file?: File;
};

type Props = {
  attachments: Attachment[];
  setAttachments: (
    next: Attachment[] | ((prev: Attachment[]) => Attachment[]),
  ) => void;
  onSend?: () => void;
  isLoading?: boolean;
  externalError?: string | null;
  ref: React.Ref<ImperativeEditor | null>;
  placeholder?: string;
  autoFocus?: boolean;
  privacyActions?: {
    follow: boolean;
    order: boolean;
    scout: boolean;
    tip: boolean;
  };
  onOpenTipModal?: () => void;
  // 新: action メニュー（旧: plusMenu）。外からボタン配列を渡せるようにする。
  // ファイル添付と書式設定は常に利用可能（内部実装のまま）
  actionMenuButtons?: {
    key?: string;
    label: string;
    icon?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }[];
  mentionUsers?: {
    id: string;
    label: string;
    image?: string | null;
  }[];
};

// ファイルが画像かどうかを判定
const isImageFile = (type: string, name?: string | null): boolean => {
  if (type.startsWith("image/")) return true;

  if (name) {
    const ext = name.split(".").pop()?.toLowerCase();
    return ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(
      ext || "",
    );
  }

  return false;
};

// ドキュメント（ProseMirror Node）向けの送信判定（最小限の any）
const isSendableDoc = (doc: unknown, attachmentsLength: number): boolean => {
  const text =
    doc && typeof (doc as { textContent?: unknown }).textContent === "string"
      ? (doc as { textContent: string }).textContent.trim()
      : "";
  if (text.length > 0) return true;

  let hasEmoji = false;
  if (doc) {
    const descendants = (doc as { descendants?: unknown }).descendants as
      | ((fn: (node: unknown) => boolean) => void)
      | undefined;
    if (typeof descendants === "function") {
      // use .call to preserve correct `this`
      descendants.call(doc, (node: unknown) => {
        if (node && typeof node === "object" && "type" in node) {
          const nodeObj = node as { type?: { name?: unknown } };
          if (nodeObj.type?.name === "emoji") {
            hasEmoji = true;
            return false;
          }
        }
        return true;
      });
    }
  }

  if (hasEmoji) return true;
  if (attachmentsLength > 0) return true;
  return false;
};

// Editorを受け取る判定。型があるのでany使用を最小化できます。
const isSendableEditor = (
  editor: Editor | null | undefined,
  attachmentsLength: number,
): boolean => {
  if (!editor) return attachmentsLength > 0;
  const text = editor.getText().trim();
  if (text.length > 0) return true;

  let hasEmoji = false;
  editor.state.doc.descendants((node: unknown) => {
    const nodeObj = node as { type?: { name?: unknown } };
    if (nodeObj.type?.name === "emoji") {
      hasEmoji = true;
      return false;
    }
    return true;
  });

  if (hasEmoji) return true;
  if (attachmentsLength > 0) return true;
  return false;
};

// EditorContentコンポーネント: useEditorStateを使用
function ChatEditorContent({
  attachments,
  setAttachments,
  onSend,
  isLoading,
  externalError,
  editorRef,
  wysiwygVisible,
  setWysiwygVisible,
  privacyActions: _privacyActions,
  onOpenTipModal: _onOpenTipModal,
  actionMenuButtons,
}: Omit<Props, "ref"> & {
  editorRef: React.Ref<ImperativeEditor | null>;
  wysiwygVisible: boolean;
  setWysiwygVisible: React.Dispatch<React.SetStateAction<boolean>>;
  actionMenuButtons?: Props["actionMenuButtons"];
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [linkRange, setLinkRange] = useState<{
    from: number;
    to: number;
  } | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const menuWrapperRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const accept = MESSAGE_CONSTRAINTS.ALLOWED_FILE_TYPES.join(",");

  // EditorContextから現在のeditorを取得
  const { editor } = useCurrentEditor();

  // 送信判定はトップレベルの `isSendable` を使用

  const editorState = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return null;

      // エディタのDOMから高さ情報を取得（2行目検知用）
      let isMultiLine = false;
      if (editorContainerRef.current) {
        const editorElement =
          editorContainerRef.current.querySelector(".ProseMirror");
        if (editorElement) {
          const contentHeight = editorElement.scrollHeight;
          const computedLineHeight = Number.parseFloat(
            window.getComputedStyle(editorElement).lineHeight,
          );
          const lineHeight = Number.isFinite(computedLineHeight)
            ? computedLineHeight
            : 24;
          isMultiLine = contentHeight > lineHeight * 1.8;
        }
      }

      return {
        isCodeBlock: editor.isActive("codeBlock"),
        isFence: editor.isActive("fence"),
        isLink: editor.isActive("link"),
        textLength: editor.getText().length,
        text: editor.getText(),
        selection: editor.view.state.selection,
        hasContent: isSendableEditor(editor, attachments.length),
        isMultiLine,
      };
    },
  });

  // エディタの状態から派生した値

  const textLength = editorState?.textLength || 0;
  const canSend = !!(
    editorState?.hasContent ||
    (editor && isSendableEditor(editor, attachments.length)) ||
    attachments.length > 0
  );

  // ファイル追加処理
  const handleFileUpload = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      if (
        attachments.length + fileArray.length >
        MESSAGE_CONSTRAINTS.MAX_ATTACHMENTS
      ) {
        setUploadError(
          `添付ファイルは${MESSAGE_CONSTRAINTS.MAX_ATTACHMENTS}個までです`,
        );
        return;
      }

      setUploadError(null);
      const newAttachments: Attachment[] = [];

      for (const file of fileArray) {
        const validation = validateFile(file);
        if (!validation.valid) {
          setUploadError(validation.error || "ファイルが無効です");
          continue;
        }

        const localUrl = URL.createObjectURL(file);
        newAttachments.push({
          id: `local-${Date.now()}-${Math.random()}`,
          url: localUrl,
          type: file.type,
          name: file.name,
          file: file,
        });
      }

      if (newAttachments.length > 0) {
        setAttachments((prev) => [...prev, ...newAttachments]);
        setUploadError(null);
      }
    },
    [setAttachments, attachments],
  );

  // ドラッグ&ドロップハンドラ
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        await handleFileUpload(files);
      }
    },
    [handleFileUpload],
  );

  const handleRemove = useCallback(
    (index: number) => {
      setAttachments((prev) => prev.filter((_, i) => i !== index));
    },
    [setAttachments],
  );

  const handleMove = useCallback(
    (activeIndex: number, overIndex: number) => {
      setAttachments((prev) => {
        const next = [...prev];
        const [moved] = next.splice(activeIndex, 1);
        next.splice(overIndex, 0, moved);
        return next;
      });
    },
    [setAttachments],
  );

  // Imperative API
  useImperativeHandle(editorRef, () => ({
    getHTML: () => editor?.getHTML() || "",
    getText: () => editor?.getText() || "",
    clearContent: () => editor?.commands.clearContent() || undefined,
    setContent: (html: string) => {
      if (!editor) return;
      editor.commands.setContent(html || "");
    },
    focus: () => {
      editor?.commands.focus("end");
    },
  }));

  // カーソル位置の更新

  // エラーのクリア
  useEffect(() => {
    if (textLength > 0 || attachments.length > 0) {
      setLocalError(null);
    }
  }, [textLength, attachments.length]);

  // メニューの外側クリック検知
  useEffect(() => {
    const mouseHandler = (e: MouseEvent) => {
      if (
        showActionMenu &&
        menuWrapperRef.current &&
        !menuWrapperRef.current.contains(e.target as Node)
      ) {
        setShowActionMenu(false);
      }
    };

    const touchHandler = (e: TouchEvent) => {
      if (
        showActionMenu &&
        menuWrapperRef.current &&
        !menuWrapperRef.current.contains(e.target as Node)
      ) {
        setShowActionMenu(false);
      }
    };

    const keyHandler = (e: KeyboardEvent) => {
      if (showActionMenu && e.key === "Escape") {
        setShowActionMenu(false);
      }
    };

    document.addEventListener("mousedown", mouseHandler);
    document.addEventListener("touchstart", touchHandler);
    document.addEventListener("keydown", keyHandler);

    return () => {
      document.removeEventListener("mousedown", mouseHandler);
      document.removeEventListener("touchstart", touchHandler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [showActionMenu]);

  useEffect(() => {
    // テキストが空で、他の拡張条件もない場合は強制的にfalse
    if (
      textLength === 0 &&
      !wysiwygVisible &&
      !localError &&
      !externalError &&
      attachments.length === 0
    ) {
      setIsExpanded(false);
      return;
    }

    if (
      wysiwygVisible ||
      localError ||
      externalError ||
      attachments.length > 0
    ) {
      setIsExpanded(true);
      return;
    }

    if (editorState?.isMultiLine) {
      setIsExpanded(true);
      return;
    }

    setIsExpanded(false);
  }, [
    wysiwygVisible,
    textLength,
    attachments.length,
    editorState?.isMultiLine,
    localError,
    externalError,
  ]);

  // リンクモーダル関連
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

  // Cmd/Ctrl + Click opens link in new tab
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const handleClick = (e: MouseEvent) => {
      const ev = e as MouseEvent & { metaKey?: boolean; ctrlKey?: boolean };
      if (!(ev.metaKey || ev.ctrlKey)) return;
      const target = e.target as HTMLElement | null;
      const a = target?.closest("a") as HTMLAnchorElement | null;
      if (a?.href) {
        window.open(a.href, "_blank", "noopener");
        e.preventDefault();
      }
    };
    dom.addEventListener("click", handleClick);
    return () => dom.removeEventListener("click", handleClick);
  }, [editor]);

  // 画像と非画像を分離
  const imageAttachments = useMemo(
    () => (attachments || []).filter((a) => isImageFile(a.type, a.name)),
    [attachments],
  );

  const activeAttachment = useMemo(
    () =>
      activeId ? attachments.find((att) => String(att.id) === activeId) : null,
    [activeId, attachments],
  );

  const handleSend = useCallback(() => {
    let canSendNow = attachments.length > 0;
    console.log(JSON.stringify(attachments));

    if (editor) {
      canSendNow =
        isSendableEditor(editor, attachments.length) ||
        isSendableDoc(editor.state.doc, attachments.length) ||
        canSendNow;
    }

    if (canSendNow) {
      setLocalError(null);
      onSend?.();
    } else {
      setLocalError("メッセージを入力するか、ファイルを添付してください");
    }
  }, [editor, attachments, onSend]);

  if (!editor) return <div />;

  return (
    <>
      <section
        ref={wrapperRef}
        aria-label="チャット入力"
        className={cn(
          styles.chatEditorWrapper,
          isExpanded && styles.expanded,
          isDraggingOver && styles.draggingOver,
          showActionMenu && styles.menuOpen,
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className={styles.menuWrapper} ref={menuWrapperRef}>
          <div className={styles.inputButtons}>
            <button
              type="button"
              className={cn(styles.actionBtn, showActionMenu && styles.show)}
              onClick={() => setShowActionMenu(!showActionMenu)}
              aria-expanded={showActionMenu}
              aria-haspopup="menu"
            >
              +
            </button>
          </div>

          {showActionMenu && (
            <div className={styles.actionMenu} role="menu">
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => fileInputRef.current?.click()}
              >
                ファイルを添付
                <MdAttachFile className={styles.menuIcon} />
              </button>

              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  setWysiwygVisible((v) => !v);
                  setShowActionMenu(false);
                }}
              >
                書式設定 {wysiwygVisible ? "OFF" : "ON"}
                <MdFormatBold className={styles.menuIcon} />
              </button>

              {actionMenuButtons?.map((btn, idx) => (
                <button
                  key={btn.key ?? btn.label ?? idx}
                  type="button"
                  className={styles.menuItem}
                  disabled={btn.disabled}
                  onClick={() => {
                    try {
                      btn.onClick?.();
                    } finally {
                      setShowActionMenu(false);
                    }
                  }}
                >
                  <span>{btn.label}</span>
                  <span className={styles.menuIcon}>{btn.icon}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {externalError && (
            <div className={styles.externalError}>{externalError}</div>
          )}
          {localError && (
            <div className={styles.externalError}>{localError}</div>
          )}

          <Toolbar
            wysiwygVisible={wysiwygVisible}
            showEmojiPicker={showEmojiPicker}
            setShowEmojiPicker={setShowEmojiPicker}
            openLinkModal={openLinkModal}
          />

          {uploadError && (
            <div className={styles.uploadError}>{uploadError}</div>
          )}

          <div className={styles.editorContainer} ref={editorContainerRef}>
            <EditorBody
              textLength={textLength}
              maxContentLength={MESSAGE_CONSTRAINTS.MAX_CONTENT_LENGTH}
            />

            <Attachments
              attachments={attachments}
              isImageFile={isImageFile}
              imageAttachments={imageAttachments}
              handleRemove={handleRemove}
              handleMove={handleMove}
              activeId={activeId}
              setActiveId={setActiveId}
              activeAttachment={activeAttachment}
            />
          </div>
        </div>

        <button
          type="button"
          className={cn(
            styles.sendBtn,
            (!canSend || isLoading) && styles.disabled,
          )}
          onClick={handleSend}
          disabled={!canSend || isLoading}
        >
          <Image
            src="/images/send.png"
            alt="チャットを送信"
            width={54}
            height={54}
            className={styles.sendIcon}
          />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple
          style={{ display: "none" }}
          onChange={(e) => handleFileUpload(e.target.files || [])}
        />
      </section>
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
    </>
  );
}

// メインコンポーネント: EditorContextを提供
export default function ChatEditor({
  attachments,
  setAttachments,
  onSend,
  isLoading,
  externalError,
  ref,
  placeholder,
  autoFocus = true,
  privacyActions,
  onOpenTipModal,
  actionMenuButtons,
  mentionUsers,
}: Props) {
  const [wysiwygVisible, setWysiwygVisible] = useState(false);
  const attachmentsRef = useRef<Attachment[]>(attachments);
  const placeholderText = placeholder ?? "メッセージを入力...";
  const mentionItemsRef = useRef<MentionSuggestionUser[]>(mentionUsers ?? []);
  const mentionEnabledRef = useRef<boolean>(Array.isArray(mentionUsers));

  useEffect(() => {
    mentionItemsRef.current = mentionUsers ?? [];
    mentionEnabledRef.current = Array.isArray(mentionUsers);
  }, [mentionUsers]);

  const mentionExtension = useMemo(
    () =>
      createMentionNode({
        suggestion: createMentionSuggestion(
          () => mentionItemsRef.current,
          () => mentionEnabledRef.current,
        ),
      }),
    [],
  );

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
          isAllowedUri: (
            url: string,
            ctx: {
              defaultProtocol: string;
              defaultValidate: (s: string) => boolean;
              protocols: Array<string | { scheme: string }>;
            },
          ) => {
            try {
              const parsedUrl = url.includes(":")
                ? new URL(url)
                : new URL(`${ctx.defaultProtocol}://${url}`);

              if (!ctx.defaultValidate(parsedUrl.href)) return false;

              const disallowedProtocols = ["javascript", "data", "ftp", "file"];
              const protocol = parsedUrl.protocol.replace(":", "");
              if (disallowedProtocols.includes(protocol)) return false;

              const allowedProtocols = ctx.protocols.map((p) =>
                typeof p === "string" ? p : p.scheme,
              );
              if (!allowedProtocols.includes(protocol)) return false;

              // optional domain blacklist
              const disallowedDomains = [
                "example-phishing.com",
                "malicious-site.net",
              ];
              if (disallowedDomains.includes(parsedUrl.hostname)) return false;

              return true;
            } catch {
              return false;
            }
          },
        },
      }),
      CodeBlockNode,
      Underline,
      EmojiNode,
      mentionExtension,
      Placeholder.configure({
        placeholder: placeholderText,
      }),
    ],
    autofocus: autoFocus,
    content: "",
    editorProps: {
      attributes: {
        class: "focus:outline-none",
        style: "min-height: 24px; max-height: 150px; overflow-y: auto;",
      },
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData("text/plain");

        if (!text) return false;

        const cleaned = text
          .normalize("NFC")
          .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "")
          .replace(/[\u202A-\u202E\u2066-\u2069\u200F]/g, "");

        event.preventDefault();

        view.dispatch(view.state.tr.insertText(cleaned));

        return true;
      },
      handleKeyDown: (view, event) => {
        if (event.key !== "Enter" || event.isComposing) return false;

        const mentionSuggestionOpen =
          typeof document !== "undefined" &&
          !!document.querySelector(".mentionSuggestion .mentionItem");

        if (mentionSuggestionOpen) {
          return false;
        }

        const { $from } = view.state.selection;
        const nodeName = $from?.parent?.type?.name;
        const inCodeBlock = nodeName === "codeBlock" || nodeName === "fence";

        // Inside a code block: keep default Enter behavior (insert newline)
        if (inCodeBlock) return false;

        // WYSIWYG off: Enter = send, Shift+Enter = newline
        if (!wysiwygVisible) {
          if (event.shiftKey) return false; // allow newline

          const canSendLocal = isSendableDoc(
            view.state.doc,
            attachmentsRef.current.length,
          );

          if (canSendLocal) onSend?.();
          event.preventDefault();
          return true;
        }

        // WYSIWYG on: Enter = newline, Shift+Enter = send
        if (event.shiftKey) {
          const canSendLocal = isSendableDoc(
            view.state.doc,
            attachmentsRef.current.length,
          );

          if (canSendLocal) onSend?.();
          event.preventDefault();
          return true;
        }

        return false;
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  // EditorContextのprovider valueをメモ化
  const providerValue = useMemo(() => ({ editor }), [editor]);

  if (!editor) return <div />;

  return (
    <EditorContext.Provider value={providerValue}>
      <ChatEditorContent
        attachments={attachments}
        setAttachments={setAttachments}
        onSend={onSend}
        isLoading={isLoading}
        externalError={externalError}
        editorRef={ref}
        wysiwygVisible={wysiwygVisible}
        setWysiwygVisible={setWysiwygVisible}
        privacyActions={privacyActions}
        onOpenTipModal={onOpenTipModal}
        actionMenuButtons={actionMenuButtons}
      />
    </EditorContext.Provider>
  );
}
