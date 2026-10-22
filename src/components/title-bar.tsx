import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { Copy, Minus, Square, X } from "lucide-solid";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { t } from "~/i18n";

const buttonClass =
  "flex w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none";

/**
 * Window chrome drawn by the app instead of Windows.
 *
 * `decorations` is disabled in `tauri.conf.json`, so this bar doubles as the
 * drag handle (the whole header is a Tauri drag region and a double click
 * maximizes it) and as the caption buttons.
 */
function WindowChrome() {
  const appWindow = getCurrentWindow();
  const [maximized, setMaximized] = createSignal(false);

  onMount(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const sync = () => {
      appWindow
        .isMaximized()
        .then((value) => {
          if (!disposed) setMaximized(value);
        })
        .catch(() => {});
    };

    sync();
    appWindow
      .onResized(sync)
      .then((off) => {
        if (disposed) off();
        else unlisten = off;
      })
      .catch(() => {});

    onCleanup(() => {
      disposed = true;
      unlisten?.();
    });
  });

  return (
    <header
      data-tauri-drag-region="deep"
      class="flex h-10 shrink-0 select-none items-center gap-2 border-b border-border/60 bg-background pr-1 pl-3"
    >
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold tracking-tight">
          {t("app.name")}
        </span>
      </div>

      <div class="ml-auto flex h-full items-stretch">
        <button
          type="button"
          title={t("action.minimize")}
          aria-label={t("action.minimize")}
          class={buttonClass}
          onClick={() => void appWindow.minimize()}
        >
          <Minus class="size-4" />
        </button>

        <button
          type="button"
          title={maximized() ? t("action.restore") : t("action.maximize")}
          aria-label={maximized() ? t("action.restore") : t("action.maximize")}
          class={buttonClass}
          onClick={() => void appWindow.toggleMaximize()}
        >
          <Show when={maximized()} fallback={<Square class="size-3.5" />}>
            <Copy class="size-3.5" />
          </Show>
        </button>

        <button
          type="button"
          title={t("action.close")}
          aria-label={t("action.close")}
          class={`${buttonClass} hover:bg-destructive hover:text-destructive-foreground`}
          onClick={() => void appWindow.close()}
        >
          <X class="size-4" />
        </button>
      </div>
    </header>
  );
}

/** Only rendered inside the Tauri webview; a plain browser keeps its own frame. */
export function TitleBar() {
  return <Show when={isTauri()}>{<WindowChrome />}</Show>;
}
