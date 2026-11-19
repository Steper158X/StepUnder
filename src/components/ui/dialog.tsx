import { createEffect, createSignal, onCleanup, splitProps, type ComponentProps } from "solid-js";
import { registerBackLayer } from "~/lib/android-back";
import { Dialog as KDialog } from "@kobalte/core/dialog";
import { X } from "lucide-solid";
import { cn } from "~/lib/utils";

function DialogRoot(props: ComponentProps<typeof KDialog>) {
  const [open, setOpen] = createSignal(props.defaultOpen ?? false);
  const [local, rest] = splitProps(props, ["open", "defaultOpen", "onOpenChange"]);
  const isOpen = () => local.open ?? open();
  const change = (value: boolean) => { setOpen(value); local.onOpenChange?.(value); };
  createEffect(() => { if (isOpen()) onCleanup(registerBackLayer("dialog", () => change(false))); });
  return <KDialog {...rest} open={isOpen()} onOpenChange={change} />;
}
export const Dialog = Object.assign(DialogRoot, {
  Trigger: KDialog.Trigger,
  Portal: KDialog.Portal,
  Overlay: KDialog.Overlay,
  Content: KDialog.Content,
  Title: KDialog.Title,
  Description: KDialog.Description,
  CloseButton: KDialog.CloseButton,
});
export const DialogTrigger = KDialog.Trigger;
export const DialogClose = KDialog.CloseButton;

export function DialogContent(
  props: ComponentProps<typeof KDialog.Content> & { showClose?: boolean },
) {
  const [local, rest] = splitProps(props, ["class", "children", "showClose"]);
  return (
    <KDialog.Portal>
      <KDialog.Overlay class="fixed inset-0 z-50 animate-fade-in bg-black/65 backdrop-blur-[2px]" />
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <KDialog.Content
          class={cn(
            "glass-panel relative w-full max-w-md animate-fade-in rounded-xl border bg-card p-5 shadow-2xl outline-none",
            local.class,
          )}
          {...rest}
        >
          {local.children}
          {local.showClose !== false && (
            <KDialog.CloseButton
              class="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Close"
            >
              <X class="size-4" />
            </KDialog.CloseButton>
          )}
        </KDialog.Content>
      </div>
    </KDialog.Portal>
  );
}

export function DialogHeader(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return <div class={cn("mb-4 space-y-1.5 pr-6", local.class)} {...rest} />;
}

export function DialogTitle(props: ComponentProps<typeof KDialog.Title>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <KDialog.Title
      class={cn("text-lg font-semibold tracking-tight", local.class)}
      {...rest}
    />
  );
}

export function DialogDescription(
  props: ComponentProps<typeof KDialog.Description>,
) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <KDialog.Description
      class={cn("text-sm text-muted-foreground", local.class)}
      {...rest}
    />
  );
}

export function DialogFooter(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      class={cn("mt-5 flex items-center justify-end gap-2", local.class)}
      {...rest}
    />
  );
}
