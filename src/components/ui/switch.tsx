import { Switch as KSwitch } from "@kobalte/core/switch";
import { cn } from "~/lib/utils";

/** On/off toggle for settings; `label` is read by screen readers only. */
export function Switch(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  class?: string;
}) {
  return (
    <KSwitch
      checked={props.checked}
      onChange={props.onChange}
      disabled={props.disabled}
      class={cn("group inline-flex items-center", props.class)}
    >
      <KSwitch.Input aria-label={props.label} class="peer" />
      <KSwitch.Control class="inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-input transition-colors group-data-[disabled]:cursor-not-allowed group-data-[disabled]:opacity-50 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background data-[checked]:bg-primary">
        <KSwitch.Thumb class="pointer-events-none block size-4 translate-x-0.5 rounded-full bg-white shadow-sm ring-0 transition-transform data-[checked]:translate-x-[1.125rem]" />
      </KSwitch.Control>
    </KSwitch>
  );
}
