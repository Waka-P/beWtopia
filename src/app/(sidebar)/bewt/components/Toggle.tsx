import SidebarToggle from "@/app/(sidebar)/components/SidebarToggle";
import toggleStyles from "@/app/(sidebar)/components/SidebarToggle.module.scss";
import type { BewtFormData } from "@/app/schemas/bewtSchema";
import { type Path, useFormContext } from "react-hook-form";

interface ToggleProps {
  id: string;
  name: Path<BewtFormData>;
  label: string;
  onChangeCallback?: () => void;
}

export function Toggle({ id, name, label, onChangeCallback }: ToggleProps) {
  const { register } = useFormContext<BewtFormData>();
  return (
    <SidebarToggle
      id={id}
      label={label}
      containerClassName={toggleStyles.toggleCont}
      inputClassName={toggleStyles.toggleInput}
      toggleClassName={toggleStyles.toggle}
      knobClassName={toggleStyles.knob}
      inputProps={register(name, {
        onChange: onChangeCallback,
      })}
    />
  );
}
