import { nanoid } from "nanoid";

export function genPublicId(): string {
  // 21文字のIDを生成する
  return nanoid();
}
