import type { FieldValues, Path } from "react-hook-form";
import { MAX_TAGS } from "../bewt/constants";
import { GenericPicker } from "./GenericPicker";

interface Skill {
  id: number | string;
  name: string;
}

interface SkillPickerProps<TFieldValues extends FieldValues> {
  skillsFieldName: Path<TFieldValues>;
  skills: Skill[];
  onChangeCallback?: () => void;
}

export function SkillPicker<TFieldValues extends FieldValues>({
  skillsFieldName,
  skills,
  onChangeCallback,
}: SkillPickerProps<TFieldValues>) {
  return (
    <GenericPicker<TFieldValues>
      selectedIdsFieldName={skillsFieldName}
      items={skills}
      onChangeCallback={onChangeCallback}
      placeholder="スキルを検索"
      maxItems={MAX_TAGS}
      allowCustom={false}
    />
  );
}
