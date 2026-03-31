import emojiData from "emoji-datasource-apple/emoji.json";

// 起動時に一度だけMapを構築
const emojiMap = new Map<string, string>(
  emojiData.map((e) => {
    // unified文字列からEmojiを復元してキーにする
    const emoji = e.unified
      .split("-")
      .map((code) => String.fromCodePoint(parseInt(code, 16)))
      .join("");
    return [emoji, e.unified.toLowerCase()];
  }),
);

export const emojiToUnified = (emoji: string): string => {
  // まずDBから正確なunifiedを引く
  const fromDB = emojiMap.get(emoji);
  if (fromDB) return fromDB;

  // DBにない場合はフォールバック（FE0Fを保持）
  return [...emoji]
    .map((c) => c.codePointAt(0))
    .filter((cp): cp is number => cp !== undefined)
    .map((cp) => cp.toString(16))
    .join("-");
};
