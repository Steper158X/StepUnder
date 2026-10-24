import { splitProps, type ComponentProps } from "solid-js";
import { DropdownMenu as KDropdownMenu } from "@kobalte/core/dropdown-menu";
import { cn } from "~/lib/utils";

export const DropdownMenu = KDropdownMenu;
export const DropdownMenuTrigger = KDropdownMenu.Trigger;
export const DropdownMenuGroup = KDropdownMenu.Group;
export const DropdownMenuGroupLabel = KDropdownMenu.GroupLabel;

export function DropdownMenuContent(
  props: ComponentProps<typeof KDropdownMenu.Content>,
) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <KDropdownMenu.Portal>
      <KDropdownMenu.Content
        class={cn(
          "glass-popover z-[110] min-w-44 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-xl animate-fade-in",
          local.class,
        )}
        {...rest}
      />
    </KDropdownMenu.Portal>
  );
}

export function DropdownMenuItem(
  props: ComponentProps<typeof KDropdownMenu.Item> & { destructive?: boolean },
) {
  const [local, rest] = splitProps(props, ["class", "destructive"]);
  return (
    <KDropdownMenu.Item
      class={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
        local.destructive && "text-destructive data-[highlighted]:bg-destructive/10",
        local.class,
      )}
      {...rest}
    />
  );
}

export function DropdownMenuSeparator(
  props: ComponentProps<typeof KDropdownMenu.Separator>,
) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <KDropdownMenu.Separator
      class={cn("-mx-1 my-1 h-px bg-border", local.class)}
      {...rest}
    />
  );
}

/**
 * Visual label for a menu section. Kobalte's `GroupLabel` may only be rendered
 * inside a `Group`, so this stays a plain element to keep menu labels usable
 * anywhere.
 */
export function DropdownMenuLabel(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      role="presentation"
      class={cn("px-2 py-1.5 text-xs text-muted-foreground", local.class)}
      {...rest}
    />
  );
}
