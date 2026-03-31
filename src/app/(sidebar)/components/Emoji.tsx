import { cn } from "@/lib/cn";
import { emojiToUnified } from "@/utils/emoji";
import Image from "next/image";

export default function Emoji({
  emoji,
  style = "apple",
  size = 24,
  className = "",
  ref = null,
}: {
  emoji: string;
  size?: number;
  style?: "apple" | "google" | "twitter" | "facebook";
  className?: string;
  ref?: React.Ref<HTMLImageElement | null>;
}) {
  const src = `https://cdn.jsdelivr.net/npm/emoji-datasource-${style}/img/${style}/64/${emojiToUnified(emoji)}.png`;

  return (
    <Image
      src={src}
      width={size}
      height={size}
      alt={`絵文字(${emoji})`}
      className={cn(className)}
      unoptimized
      priority={false}
      ref={ref}
    />
  );
}
