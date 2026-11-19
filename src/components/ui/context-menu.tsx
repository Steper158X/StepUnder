import { createEffect, createSignal, onCleanup, splitProps, type ComponentProps } from "solid-js";
import { registerBackLayer } from "~/lib/android-back";
import { ContextMenu as KContextMenu } from "@kobalte/core/context-menu";
import { ChevronRight } from "lucide-solid";
import { cn } from "~/lib/utils";

export function ContextMenu(props: ComponentProps<typeof KContextMenu>) {
  const [open, setOpen] = createSignal(false);
  const [local, rest] = splitProps(props, ["onOpenChange"]);
  const change = (value: boolean) => { setOpen(value); local.onOpenChange?.(value); };
  createEffect(() => {
    if (open()) onCleanup(registerBackLayer("menu", () => {
      (document.activeElement ?? document).dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }),
      );
    }));
  });
  return <KContextMenu {...rest} onOpenChange={change} />;
}
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

export const ContextMenuSub = KContextMenu.Sub;

export function ContextMenuSubTrigger(
  props: ComponentProps<typeof KContextMenu.SubTrigger>,
) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <KContextMenu.SubTrigger
      class={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[expanded]:bg-accent data-[expanded]:text-accent-foreground [&_svg]:size-4",
        local.class,
      )}
      {...rest}
    >
      {local.children}
      <ChevronRight class="ml-auto size-4 text-muted-foreground" />
    </KContextMenu.SubTrigger>
  );
}

export function ContextMenuSubContent(
  props: ComponentProps<typeof KContextMenu.SubContent>,
) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <KContextMenu.Portal>
      <KContextMenu.SubContent
        class={cn(
          "glass-popover z-[111] min-w-40 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-xl animate-fade-in",
          local.class,
        )}
        {...rest}
      />
    </KContextMenu.Portal>
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
