import { Show, splitProps, type ComponentProps, type JSX } from "solid-js";
import { Checkbox as KCheckbox } from "@kobalte/core/checkbox";
import { Check } from "lucide-solid";
import { cn } from "~/lib/utils";

export function Checkbox(
  props: Omit<ComponentProps<typeof KCheckbox>, "children"> & {
    children?: JSX.Element;
  },
) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <KCheckbox class={cn("group flex items-center gap-2", local.class)} {...rest}>
      <KCheckbox.Input />
      <KCheckbox.Control class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input bg-transparent text-primary-foreground transition-colors data-[checked]:border-primary data-[checked]:bg-primary">
        <KCheckbox.Indicator>
          <Check class="size-3.5" stroke-width={3} />
        </KCheckbox.Indicator>
      </KCheckbox.Control>
      {local.children}
    </KCheckbox>
  );
}

export function CheckboxField(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  name?: string;
  class?: string;
}) {
  return (
    <Checkbox
      checked={props.checked}
      onChange={(value: boolean | "indeterminate") =>
        props.onChange(value === true)
      }
      disabled={props.disabled}
      name={props.name}
      class={cn("items-start", props.class)}
    >
      <div class="grid gap-0.5 leading-tight">
        <Show when={props.label}>
          <KCheckbox.Label class="cursor-pointer select-none text-sm font-medium">
            {props.label}
          </KCheckbox.Label>
        </Show>
        <Show when={props.description}>
          <KCheckbox.Description class="text-xs text-muted-foreground">
            {props.description}
          </KCheckbox.Description>
        </Show>
      </div>
    </Checkbox>
  );
}
