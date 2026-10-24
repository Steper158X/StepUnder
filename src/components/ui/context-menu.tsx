import { splitProps, type ComponentProps } from "solid-js";
import { ContextMenu as KContextMenu } from "@kobalte/core/context-menu";
import { cn } from "~/lib/utils";

export const ContextMenu = KContextMenu;
export const ContextMenuTrigger = KContextMenu.Trigger;

export function ContextMenuContent(
  props: ComponentProps<typeof KContextMenu.Content>,
) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <KContextMenu.Portal>
      <KContextMenu.Content
        class={cn(
          "glass-popover z-[110] min-w-44 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-xl animate-fade-in",
          local.class,
        )}
        {...rest}
      />
    </KContextMenu.Portal>
  );
}

export function ContextMenuItem(
  props: ComponentProps<typeof KContextMenu.Item>,
) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <KContextMenu.Item
      class={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
        local.class,
      )}
      {...rest}
    />
  );
}

export function ContextMenuSeparator(
  props: ComponentProps<typeof KContextMenu.Separator>,
) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <KContextMenu.Separator
      class={cn("-mx-1 my-1 h-px bg-border", local.class)}
      {...rest}
    />
  );
}
