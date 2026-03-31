import type { FieldValues, Path } from "react-hook-form";
import { MAX_TAGS } from "../bewt/constants";
import { GenericPicker } from "./GenericPicker";

interface Job {
  id: number | string;
  name: string;
}

interface JobPickerProps<TFieldValues extends FieldValues> {
  jobsFieldName: Path<TFieldValues>;
  jobs: Job[];
  onChangeCallback?: () => void;
}

export default function JobPicker<TFieldValues extends FieldValues>({
  jobsFieldName,
  jobs,
  onChangeCallback,
}: JobPickerProps<TFieldValues>) {
  return (
    <GenericPicker<TFieldValues>
      selectedIdsFieldName={jobsFieldName}
      items={jobs}
      onChangeCallback={onChangeCallback}
      placeholder="職業を検索"
      maxItems={MAX_TAGS}
      allowCustom={false}
    />
  );
}
