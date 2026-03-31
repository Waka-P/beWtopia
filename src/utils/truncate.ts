export function truncate(str: string, m: number): string {
  if (str.length <= m) return str;
  return `${str.slice(0, m - 3)}...`;
}
