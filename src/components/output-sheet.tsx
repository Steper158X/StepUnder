import {
  For,
  Show,
  createEffect,
  createSignal,
  on,
  onCleanup,
  onMount,
} from "solid-js";
import {
  Bluetooth,
  Check,
  ChevronRight,
  Headphones,
  Smartphone,
  Speaker,
  Usb,
  X,
} from "lucide-solid";
import { t, type MessageKey } from "~/i18n";
import { cn } from "~/lib/utils";
import {
  hasAudioOutputs,
  listAudioOutputs,
  onAudioOutputsChanged,
  showAudioOutputSwitcher,
  type AudioOutput,
} from "~/lib/android-media";
import { toast } from "~/components/toaster";
import { Button } from "~/components/ui/button";

const [outputOpen, setOutputOpen] = createSignal(false);
const [outputs, setOutputs] = createSignal<AudioOutput[]>([]);

export { outputOpen, setOutputOpen };

function refreshOutputs() {
  setOutputs(listAudioOutputs());
}

const kindIcon = {
  speaker: Smartphone,
  bluetooth: Bluetooth,
  wired: Headphones,
  usb: Usb,
} as const;

const kindLabel: Record<AudioOutput["kind"], MessageKey> = {
  speaker: "player.outputSpeaker",
  bluetooth: "player.outputBluetooth",
  wired: "player.outputWired",
  usb: "player.outputUsb",
};

function outputName(output: AudioOutput) {
  return output.name || t(kindLabel[output.kind]);
}

function openSwitcher() {
  if (showAudioOutputSwitcher() === "settings") {
    toast(t("player.outputSettingsOpened"));
  }
}

/**
 * The full screen player's speaker button. Its icon follows the output media
 * is playing through. Only the Android app can list outputs, so it is hidden
 * elsewhere.
 */
export function OutputButton(props: { class?: string }) {
  // The sheet belongs to the full screen player; close it along with it.
  onCleanup(() => setOutputOpen(false));

  onMount(() => {
    if (!hasAudioOutputs()) return;
    refreshOutputs();
    const stop = onAudioOutputsChanged(refreshOutputs);
    // The system switcher changes the route without adding or removing a
    // device, so look again when the app comes back to the front.
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshOutputs();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refreshOutputs);
    onCleanup(() => {
      stop();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refreshOutputs);
    });
  });

  const active = () => outputs().find((output) => output.active);
  const Icon = () => {
    const kind = active()?.kind;
    const Component =
      kind === "bluetooth"
        ? Bluetooth
        : kind === "wired"
          ? Headphones
          : kind === "usb"
            ? Usb
            : Speaker;
    return <Component class="size-5" />;
  };

  return (
    <Show when={hasAudioOutputs()}>
      <button
        type="button"
        onClick={() => setOutputOpen(!outputOpen())}
        title={t("player.output")}
        aria-label={t("player.output")}
        aria-pressed={outputOpen()}
        class={cn(
          "relative flex cursor-pointer items-center justify-center rounded-full p-2.5 text-foreground/75 transition-[color,transform] active:scale-90",
          (outputOpen() || (active() && active()!.kind !== "speaker")) &&
            "text-primary",
          props.class,
        )}
      >
        <Icon />
      </button>
    </Show>
  );
}

/** Phones: the output list pops up from the bottom, like the queue. */
export function OutputSheet() {
  const [leaving, setLeaving] = createSignal(false);
  let leaveTimer: ReturnType<typeof setTimeout> | undefined;

  createEffect(
    on(outputOpen, (open, wasOpen) => {
      clearTimeout(leaveTimer);
      if (open) {
        setLeaving(false);
        refreshOutputs();
        // Pick up a switch made in the system dialog while the sheet is open.
        const timer = setInterval(refreshOutputs, 1500);
        onCleanup(() => clearInterval(timer));
        return;
      }
      if (!wasOpen) return;
      setLeaving(true);
      leaveTimer = setTimeout(() => setLeaving(false), 280);
    }),
  );
  onCleanup(() => clearTimeout(leaveTimer));

  const close = () => setOutputOpen(false);

  return (
    <Show when={outputOpen() || leaving()}>
      <div class={cn("fixed inset-0 z-[60]", leaving() && "pointer-events-none")}>
        <div
          aria-hidden="true"
          onClick={close}
          class={cn(
            "absolute inset-0 bg-black/50",
            leaving() ? "animate-fade-out" : "animate-fade-in",
          )}
        />
        <aside
          role="dialog"
          aria-label={t("player.output")}
          class={cn(
            "absolute inset-x-0 bottom-0 flex max-h-[70dvh] flex-col overflow-hidden rounded-t-2xl border-t border-border/60 bg-card pb-[env(safe-area-inset-bottom)] shadow-2xl",
            leaving() ? "animate-sheet-down" : "animate-sheet-up",
          )}
        >
          <div class="flex shrink-0 justify-center pt-2" aria-hidden="true">
            <div class="h-1 w-10 rounded-full bg-muted-foreground/40" />
          </div>
          <div class="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4">
            <div class="flex items-center gap-2">
              <Speaker class="size-4 text-muted-foreground" />
              <h2 class="text-sm font-semibold">{t("player.output")}</h2>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={close}
              aria-label={t("action.close")}
            >
              <X class="size-4" />
            </Button>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto p-2">
            <For each={outputs()}>
              {(output) => {
                const Icon = kindIcon[output.kind];
                return (
                  <button
                    type="button"
                    onClick={openSwitcher}
                    class={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-foreground/5 active:bg-foreground/10",
                      output.active && "bg-primary/10",
                    )}
                  >
                    <div
                      class={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground/5",
                        output.active && "bg-primary text-primary-foreground",
                      )}
                    >
                      <Icon class="size-5" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <p
                        class={cn(
                          "truncate text-sm font-medium",
                          output.active && "text-primary",
                        )}
                      >
                        {outputName(output)}
                      </p>
                      <Show when={output.active}>
                        <p class="text-xs text-muted-foreground">
                          {t("player.outputPlaying")}
                        </p>
                      </Show>
                    </div>
                    <Show when={output.active}>
                      <Check class="size-5 shrink-0 text-primary" />
                    </Show>
                  </button>
                );
              }}
            </For>
          </div>

          <div class="shrink-0 space-y-2 border-t border-border/60 p-4">
            <Button class="w-full" onClick={openSwitcher}>
              {t("player.outputSwitch")}
              <ChevronRight class="size-4" />
            </Button>
            <p class="text-center text-xs text-muted-foreground">
              {t("player.outputHint")}
            </p>
          </div>
        </aside>
      </div>
    </Show>
  );
}
