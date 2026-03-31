type HighlightedTextProps = {
  text: string;
  keyword: string;
};

/**
 * 検索キーワードにヒットした部分を<mark>タグで囲んで表示するコンポーネント
 */
export default function HighlightedText({
  text,
  keyword,
}: HighlightedTextProps) {
  if (!keyword) return <>{text}</>;

  const regex = new RegExp(
    `(${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi",
  );
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) => {
        if (part.toLowerCase() === keyword.toLowerCase()) {
          // biome-ignore lint: 順序が変化しないためindexをkeyに使用
          return <mark key={index}>{part}</mark>;
        }
        return part;
      })}
    </>
  );
}
