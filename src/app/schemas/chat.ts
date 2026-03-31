import { z } from "zod";

export const MESSAGE_CONSTRAINTS = {
  MAX_CONTENT_LENGTH: 10000,
  MAX_ATTACHMENTS: 10,
  MAX_IMAGE_ATTACHMENTS: 5,
  MAX_NON_IMAGE_ATTACHMENTS: 5,
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  ALLOWED_FILE_TYPES: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/heic",
    "image/heif",
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
    "application/x-zip",
    "application/x-zip-compressed",
    "application/x-7z-compressed",
    "application/x-rar-compressed",
    "application/gzip",
    "application/json",
    "application/xml",
    "text/csv",
  ],

  // 画像として扱うMIMEタイプを明示的に定義
  IMAGE_MIME_TYPES: [
    "image/jpeg",
    "image/jpg", // 非標準だがブラウザが返すことがある
    "image/png",
    "image/gif",
    "image/webp",
    "image/avif",
    "image/bmp",
    "image/svg+xml",
    "image/heic",
    "image/heif",
  ],
} as const;

// MIMEタイプが画像かどうかを判定するユーティリティ
// image/* プレフィックスで広く捕捉しつつ、ALLOWED_FILE_TYPESに含まれるものだけ通す
export function isImageMimeType(type: string): boolean {
  if (typeof type !== "string") return false;
  // ALLOWED_FILE_TYPESに含まれている image/* をホワイトリストとして使う
  return (MESSAGE_CONSTRAINTS.IMAGE_MIME_TYPES as readonly string[]).includes(
    type,
  );
}

// Tiptap HTMLからプレーンテキストを抽出するユーティリティ（サーバー・クライアント共用）
// Tiptap HTMLからプレーンテキストを抽出するユーティリティ（サーバー・クライアント共用）
export function extractTextFromTiptapHtml(
  html: string | null | undefined,
): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\u00A0/g, " ")
    .trim();
}

// 絵文字ノードが1つ以上存在するか（属性順序に依存しない判定）
export function hasTiptapEmojiNode(html: string | null | undefined): boolean {
  if (!html) return false;
  return /data-type=["']emoji["']/.test(html);
}

// テキストまたは絵文字ノードを含む「送信可能なコンテンツ」があるか
export function hasSendableContent(html: string | null | undefined): boolean {
  return extractTextFromTiptapHtml(html).length > 0 || hasTiptapEmojiNode(html);
}

export const chatAttachmentSchema = z.object({
  url: z.url("有効なURLである必要があります"),
  type: z
    .string()
    .min(1, "ファイルタイプは必須です")
    .max(100, "ファイルタイプが長すぎます"),
  name: z.string().min(1, "ファイル名は必須です"),
});

export const createChatMessageSchema = z
  .object({
    content: z
      .string()
      .nullable()
      .optional()
      // 文字数チェックをTiptap HTMLのテキスト抽出後に行う
      .refine(
        (val) => {
          const text = extractTextFromTiptapHtml(val);
          return text.length <= MESSAGE_CONSTRAINTS.MAX_CONTENT_LENGTH;
        },
        {
          message: `メッセージは${MESSAGE_CONSTRAINTS.MAX_CONTENT_LENGTH}文字以内にしてください`,
        },
      ),
    attachments: z
      .array(chatAttachmentSchema)
      .max(
        MESSAGE_CONSTRAINTS.MAX_ATTACHMENTS,
        `添付ファイルは${MESSAGE_CONSTRAINTS.MAX_ATTACHMENTS}個までです`,
      )
      .optional(),
  })
  .refine(
    (data) => {
      const hasContent = hasSendableContent(data.content);
      const hasAttachments = (data.attachments ?? []).length > 0;
      return hasContent || hasAttachments;
    },
    {
      message: "メッセージまたは添付ファイルが必要です",
    },
  )
  .refine(
    (data) => {
      const attachments = data.attachments ?? [];
      if (attachments.length === 0) return true;

      let imageCount = 0;
      let nonImageCount = 0;

      for (const att of attachments) {
        if (isImageMimeType(att.type)) {
          imageCount++;
        } else {
          nonImageCount++;
        }
      }

      return (
        imageCount <= MESSAGE_CONSTRAINTS.MAX_IMAGE_ATTACHMENTS &&
        nonImageCount <= MESSAGE_CONSTRAINTS.MAX_NON_IMAGE_ATTACHMENTS
      );
    },
    {
      message: `画像は${MESSAGE_CONSTRAINTS.MAX_IMAGE_ATTACHMENTS}個、その他ファイルは${MESSAGE_CONSTRAINTS.MAX_NON_IMAGE_ATTACHMENTS}個までです`,
      path: ["attachments"],
    },
  );

export type CreateChatMessageInput = z.infer<typeof createChatMessageSchema>;

export const validateFile = (
  file: File,
): { valid: boolean; error?: string } => {
  if (file.size > MESSAGE_CONSTRAINTS.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `ファイルサイズは${MESSAGE_CONSTRAINTS.MAX_FILE_SIZE / 1024 / 1024}MB以内にしてください`,
    };
  }

  if (
    !MESSAGE_CONSTRAINTS.ALLOWED_FILE_TYPES.includes(
      file.type as (typeof MESSAGE_CONSTRAINTS.ALLOWED_FILE_TYPES)[number],
    )
  ) {
    return {
      valid: false,
      error: "対応していないファイル形式です",
    };
  }

  return { valid: true };
};

export const createChatRoomSchema = z.object({
  targetUserId: z.string().min(1, "ユーザーIDは必須です"),
});

export type CreateChatRoomInput = z.infer<typeof createChatRoomSchema>;
