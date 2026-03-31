import { GenericPickerBase } from "./GenericPicker";

interface JobItem {
  id: number | string;
  name: string;
}

interface JobFilterPickerProps {
  jobs: JobItem[];
  selectedJobIds: Array<number | string>;
  onChange: (ids: Array<number | string>) => void;
}

/**
 * フィルター用の職業Picker
 * - フォームコンテキストに依存しない
 * - 新規職業追加なし
 * - 選択数の上限なし
 */
export function JobFilterPicker({
  jobs,
  selectedJobIds,
  onChange,
}: JobFilterPickerProps) {
  return (
    <GenericPickerBase
      availableItems={jobs}
      selectedItemIds={selectedJobIds}
      selectedNewNames={[]}
      onChangeItemIds={onChange}
      onChangeNewNames={() => {}}
      placeholder="職業を検索"
      // maxItems を指定しないことで上限なし
      allowCustom={false}
    />
  );
}
