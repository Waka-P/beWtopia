/**
 * 指定された日時から現在までの相対時間をフォーマットして返します。
 * 例: "たった今", "5分前", "2時間前", "3日前"
 */
export const formatTimeAgo = (value: string | number | Date): string => {
  const target = new Date(value).getTime();
  const now = Date.now();

  // 無効な日付の場合は空文字などを返すか、そのまま処理するか要検討だがここでは元ロジックに準拠
  if (Number.isNaN(target)) return "";

  // 未来日時の場合は「たった今」とする
  if (target > now) return "たった今";

  const diffMs = now - target;
  const diffMinutes = Math.floor(diffMs / (60 * 1000));

  // 1分未満
  if (diffMinutes < 1) return "たった今";

  // 5分前までは分単位
  if (diffMinutes <= 5) {
    return `${diffMinutes}分前`;
  }

  // その後は 10分刻み (〜60分)
  if (diffMinutes <= 15) return "10分前";
  if (diffMinutes <= 25) return "20分前";
  if (diffMinutes <= 35) return "30分前";
  if (diffMinutes <= 45) return "40分前";
  if (diffMinutes <= 55) return "50分前";
  if (diffMinutes <= 60) return "1時間前";

  const diffHours = Math.floor(diffMinutes / 60);

  // 1時間以上24時間未満は時間単位
  if (diffHours < 24) {
    return `${diffHours}時間前`;
  }

  const diffDays = Math.floor(diffHours / 24);

  // 1〜6日前
  if (diffDays < 7) {
    return `${diffDays}日前`;
  }

  const diffWeeks = Math.floor(diffDays / 7);

  // 1〜3週間前程度
  if (diffWeeks < 4) {
    return `${diffWeeks}週間前`;
  }

  const diffMonths = Math.floor(diffDays / 30);

  // 1〜11か月前
  if (diffMonths < 12) {
    return `${diffMonths}か月前`;
  }

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}年前`;
};
