import { GenericPickerBase } from "./GenericPicker";

interface TagItem {
  id: number | string;
  name: string;
}

interface TagFilterPickerProps {
  tags: TagItem[];
  selectedTagIds: Array<number | string>;
  onChange: (ids: Array<number | string>) => void;
}

/**
 * フィルター用のタグPicker
 * - フォームコンテキストに依存しない
 * - 新規タグ追加なし
 * - 選択数の上限なし
 */
export function TagFilterPicker({
  tags,
  selectedTagIds,
  onChange,
}: TagFilterPickerProps) {
  return (
    <GenericPickerBase
      availableItems={tags}
      selectedItemIds={selectedTagIds}
      selectedNewNames={[]}
      onChangeItemIds={onChange}
      onChangeNewNames={() => {}}
      placeholder="タグを検索"
      // maxItems を指定しないことで上限なし
      allowCustom={false}
    />
  );
}
