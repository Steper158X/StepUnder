import { createSignal, For, Show } from "solid-js";
import { CircleAlert, CircleCheck, Info, X } from "lucide-solid";
import { cn } from "~/lib/utils";

export type ToastVariant = "default" | "success" | "error";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

const [items, setItems] = createSignal<ToastItem[]>([]);
let counter = 0;

export function dismissToast(id: number) {
  setItems((list) => list.filter((item) => item.id !== id));
}

export function toast(
  title: string,
  description?: string,
  variant: ToastVariant = "default",
) {
  const id = (counter += 1);
  setItems((list) => [...list.slice(-3), { id, title, description, variant }]);
  setTimeout(() => dismissToast(id), 4200);
  return id;
}

const icons = {
  default: Info,
  success: CircleCheck,
  error: CircleAlert,
};

export function Toaster() {
  return (
    <div class="pointer-events-none fixed bottom-28 right-4 z-[120] flex w-[min(92vw,22rem)] flex-col gap-2">
      <For each={items()}>
        {(item) => {
          const Icon = icons[item.variant];
          return (
            <div
              class={cn(
                "pointer-events-auto animate-slide-in-right rounded-lg border bg-popover/95 p-3 text-popover-foreground shadow-xl backdrop-blur",
                item.variant === "error" && "border-destructive/40",
                item.variant === "success" && "border-primary/40",
              )}
            >
              <div class="flex items-start gap-2.5">
                <Icon
                  class={cn(
                    "mt-0.5 size-4 shrink-0",
                    item.variant === "error"
                      ? "text-destructive"
                      : item.variant === "success"
                        ? "text-primary"
                        : "text-muted-foreground",
                  )}
                />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium">{item.title}</p>
                  <Show when={item.description}>
                    <p class="mt-0.5 text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </Show>
                </div>
                <button
                  type="button"
                  class="rounded-sm text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => dismissToast(item.id)}
                  aria-label="Dismiss"
                >
                  <X class="size-3.5" />
                </button>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}
