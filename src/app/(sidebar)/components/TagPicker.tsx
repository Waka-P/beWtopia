import type { FieldValues, Path } from "react-hook-form";
import { MAX_TAGS } from "../bewt/constants";
import { GenericPicker } from "./GenericPicker";

interface Tag {
  id: number | string;
  name: string;
}

interface TagPickerProps<TFieldValues extends FieldValues> {
  tagsFieldName: Path<TFieldValues>;
  newTagNamesFieldName: Path<TFieldValues>;
  tags: Tag[];
  onChangeCallback?: () => void;
}

/**
 * タグ専用のPicker（新規タグ追加が可能）
 * GenericPickerのラッパー
 */
export function TagPicker<TFieldValues extends FieldValues>({
  tagsFieldName,
  newTagNamesFieldName,
  tags,
  onChangeCallback,
}: TagPickerProps<TFieldValues>) {
  return (
    <GenericPicker<TFieldValues>
      selectedIdsFieldName={tagsFieldName}
      newNamesFieldName={newTagNamesFieldName}
      items={tags}
      onChangeCallback={onChangeCallback}
      placeholder="タグを検索"
      maxItems={MAX_TAGS}
      allowCustom={true}
    />
  );
}
