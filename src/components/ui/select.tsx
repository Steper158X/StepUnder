import type { JSX } from "solid-js";
import {
  Content as SelectContent,
  Icon as SelectIcon,
  Item as SelectItem,
  ItemIndicator as SelectItemIndicator,
  ItemLabel as SelectItemLabel,
  Listbox as SelectListbox,
  Portal as SelectPortal,
  Root as SelectRoot,
  Trigger as SelectTrigger,
  Value as SelectValue,
} from "@kobalte/core/select";
import { Check, ChevronDown } from "lucide-solid";
import { cn } from "~/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Styled single-choice select built on Kobalte (the same primitive solid-ui
 * uses), so the dropdown matches the rest of the interface instead of the
 * browser's native menu.
 */
export function Select(props: {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  class?: string;
  "aria-label"?: string;
}) {
  const labelOf = (value: string | undefined) =>
    props.options.find((option) => option.value === value)?.label;

  const optionDisabled = (value: string) =>
    Boolean(props.options.find((option) => option.value === value)?.disabled);

  return (
    <div class={cn("w-full", props.class)}>
      <SelectRoot<string>
        options={props.options.map((option) => option.value)}
        optionDisabled={optionDisabled}
        value={props.value}
        defaultValue={props.defaultValue}
        onChange={(value) => {
          if (value !== null) props.onChange?.(value);
        }}
        placeholder={props.placeholder}
        disabled={props.disabled}
        sameWidth
        itemComponent={(itemProps) => (
          <SelectItem
            item={itemProps.item}
            class="relative flex cursor-pointer select-none items-center gap-2 rounded-md py-1.5 pl-2 pr-8 text-sm outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
          >
            <SelectItemLabel class="truncate">
              {labelOf(itemProps.item.rawValue) ?? itemProps.item.rawValue}
            </SelectItemLabel>
            <SelectItemIndicator class="absolute right-2 flex items-center">
              <Check class="size-3.5 text-primary" />
            </SelectItemIndicator>
          </SelectItem>
        )}
      >
        <SelectTrigger
          aria-label={props["aria-label"]}
          class="flex h-9 w-full min-w-0 cursor-pointer items-center justify-between gap-2 overflow-hidden rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition-colors hover:bg-accent/30 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder-shown]:text-muted-foreground"
        >
          <SelectValue<string> class="min-w-0 flex-1 overflow-hidden">
            {(state) => (
              <span class="block truncate">
                {labelOf(state.selectedOption()) ??
                  props.placeholder ??
                  "\u00a0"}
              </span>
            )}
          </SelectValue>
          <SelectIcon>
            <ChevronDown class="size-4 shrink-0 text-muted-foreground" />
          </SelectIcon>
        </SelectTrigger>
        <SelectPortal>
          <SelectContent class="glass-popover z-[120] max-h-72 min-w-[var(--kb-popper-anchor-width)] overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-xl animate-fade-in">
            <SelectListbox />
          </SelectContent>
        </SelectPortal>
      </SelectRoot>
    </div>
  );
}

export function Skeleton(props: { class?: string }) {
  return (
    <div
      class={cn("animate-pulse rounded-md bg-muted/70", props.class)}
      aria-hidden="true"
    />
  );
}

export function Separator(props: { class?: string; orientation?: "horizontal" | "vertical" }) {
  return (
    <div
      role="separator"
      class={cn(
        "shrink-0 bg-border",
        props.orientation === "vertical" ? "h-full w-px" : "h-px w-full",
        props.class,
      )}
    />
  );
}

export function Badge(props: {
  children: JSX.Element;
  variant?: "default" | "secondary" | "outline";
  class?: string;
}) {
  return (
    <span
      class={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        props.variant === "outline"
          ? "border border-border text-muted-foreground"
          : props.variant === "secondary"
            ? "bg-secondary text-secondary-foreground"
            : "bg-primary/15 text-primary",
        props.class,
      )}
    >
      {props.children}
    </span>
  );
}
