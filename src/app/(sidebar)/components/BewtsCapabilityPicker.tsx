"use client";

import type { BewtsCapability } from "@/generated/prisma/enums";
import {
  CAPABILITY_OPTIONS,
  normalizeCapabilities,
} from "@/lib/bewtsCapabilities";
import { GenericPickerBase } from "./GenericPicker";

type Props = {
  selectedCapabilities: BewtsCapability[];
  onChange: (capabilities: BewtsCapability[]) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function BewtsCapabilityPicker({
  selectedCapabilities,
  onChange,
  disabled = false,
  placeholder = "権限を選択",
}: Props) {
  const handleChangeItemIds = (values: Array<number | string>) => {
    const nextRaw = values.filter(
      (value): value is BewtsCapability => typeof value === "string",
    );

    const removedPublish =
      selectedCapabilities.includes("PUBLISH") && !nextRaw.includes("PUBLISH");
    const removedManageApp =
      selectedCapabilities.includes("MANAGE_APP") &&
      !nextRaw.includes("MANAGE_APP");

    if (removedPublish || removedManageApp) {
      const withoutPublishPair = nextRaw.filter(
        (capability) => capability !== "PUBLISH" && capability !== "MANAGE_APP",
      );
      onChange(normalizeCapabilities(withoutPublishPair));
      return;
    }

    onChange(normalizeCapabilities(nextRaw));
  };

  return (
    <GenericPickerBase
      availableItems={CAPABILITY_OPTIONS}
      selectedItemIds={selectedCapabilities}
      selectedNewNames={[]}
      onChangeItemIds={handleChangeItemIds}
      onChangeNewNames={() => {}}
      placeholder={placeholder}
      allowCustom={false}
      isDisabled={disabled}
      maxItems={CAPABILITY_OPTIONS.length}
      disabledPlaceholder="編集できません"
    />
  );
}
