"use client";

import SidebarToggle from "@/app/(sidebar)/components/SidebarToggle";
import toggleStyles from "@/app/(sidebar)/components/SidebarToggle.module.scss";

type SettingsToggleProps = {
  id: string;

  label: string;

  checked: boolean;

  onChange: () => void;
};

export default function SettingsToggle({
  id,
  label,
  checked,
  onChange,
}: SettingsToggleProps) {
  return (
    <SidebarToggle
      id={id}
      label={label}
      checked={checked}
      onChange={onChange}
      containerClassName={toggleStyles.toggleCont}
      inputClassName={toggleStyles.toggleInput}
      toggleClassName={toggleStyles.toggle}
      knobClassName={toggleStyles.knob}
    />
  );
}
