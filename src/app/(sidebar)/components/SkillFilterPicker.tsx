import { GenericPickerBase } from "./GenericPicker";

interface SkillItem {
  id: number | string;
  name: string;
}

interface SkillFilterPickerProps {
  skills: SkillItem[];
  selectedSkillIds: Array<number | string>;
  onChange: (ids: Array<number | string>) => void;
}

/**
 * フィルター用のスキルPicker
 * - フォームコンテキストに依存しない
 * - 新規スキル追加なし
 * - 選択数の上限なし
 */
export function SkillFilterPicker({
  skills,
  selectedSkillIds,
  onChange,
}: SkillFilterPickerProps) {
  return (
    <GenericPickerBase
      availableItems={skills}
      selectedItemIds={selectedSkillIds}
      selectedNewNames={[]}
      onChangeItemIds={onChange}
      onChangeNewNames={() => {}}
      placeholder="スキルを検索"
      // maxItems を指定しないことで上限なし
      allowCustom={false}
    />
  );
}
