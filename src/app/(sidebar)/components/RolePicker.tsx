"use client";

import { GenericPickerBase } from "./GenericPicker";

export type RoleOption = {
  id: number;
  name: string;
  userId?: number | null;
};

type RolePickerProps = {
  roles: RoleOption[];
  selectedRoleIds: number[];
  onChange: (roleIds: number[]) => void;
  placeholder?: string;
  maxItems?: number;
  disabled?: boolean;
};

export function RolePicker({
  roles,
  selectedRoleIds,
  onChange,
  placeholder = "役割を選択",
  maxItems,
  disabled = false,
}: RolePickerProps) {
  return (
    <GenericPickerBase
      availableItems={roles.map((r) => ({ id: r.id, name: r.name }))}
      selectedItemIds={selectedRoleIds}
      selectedNewNames={[]}
      onChangeItemIds={(itemIds) =>
        onChange(
          itemIds
            .map((itemId) => Number(itemId))
            .filter((itemId) => Number.isFinite(itemId)),
        )
      }
      onChangeNewNames={() => {}}
      placeholder={placeholder}
      maxItems={maxItems}
      allowCustom={false}
      isDisabled={disabled}
      disabledPlaceholder="選択可能な役割がありません"
    />
  );
}
