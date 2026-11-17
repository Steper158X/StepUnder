import {
  For,
  Show,
  createEffect,
  createSignal,
  on,
  onCleanup,
} from "solid-js";
import {
  ListMusic,
  LoaderCircle,
  Maximize2,
  MicVocal,
  Trash2,
  X,
} from "lucide-solid";
import { usePlayer } from "~/player/store";
import { sideLyrics } from "~/state/settings";
import { LyricsPanel } from "~/components/now-playing";
import { t } from "~/i18n";
import { formatTime } from "~/lib/format";
import { cn } from "~/lib/utils";
import { isNarrow } from "~/lib/platform";
import { Cover, EmptyState, PlayingBars } from "~/components/common";
import { Button } from "~/components/ui/button";
import { VirtualList } from "~/components/virtual-list";

/**
 * The right column: the queue, and (with the side lyrics setting) a lyrics
 * card above it. Lyrics fill the column while the queue is closed and share
 * it half and half while it is open; app.css `.side-column` runs the motion.
 */
export function QueuePanel() {
  return (
    <Show when={isNarrow()} fallback={<SidePanel />}>
      <QueueSheet />
    </Show>
  );
}

/**
 * Phones: the queue pops up from the bottom over half the screen and slides
 * back down when closed. Phones have no room for the side lyrics column.
 */
function QueueSheet() {
  const player = usePlayer();
  const [leaving, setLeaving] = createSignal(false);
  let leaveTimer: ReturnType<typeof setTimeout> | undefined;

  createEffect(
    on(player.queueOpen, (open, wasOpen) => {
      clearTimeout(leaveTimer);
      if (open) {
        setLeaving(false);
        return;
      }
      if (!wasOpen) return;
      setLeaving(true);
      leaveTimer = setTimeout(() => setLeaving(false), 280);
    }),
  );
  onCleanup(() => clearTimeout(leaveTimer));

  const close = () => player.setQueueOpen(false);

  return (
    <Show when={player.queueOpen() || leaving()}>
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
          aria-label={t("player.queue")}
          class={cn(
            "absolute inset-x-0 bottom-0 flex h-[50dvh] flex-col overflow-hidden rounded-t-2xl border-t border-border/60 bg-card pb-[env(safe-area-inset-bottom)] shadow-2xl",
            leaving() ? "animate-sheet-down" : "animate-sheet-up",
          )}
        >
          <div class="flex shrink-0 justify-center pt-2" aria-hidden="true">
            <div class="h-1 w-10 rounded-full bg-muted-foreground/40" />
          </div>
          <div class="min-h-0 flex-1">
            <QueueList class="w-full max-w-none" />
          </div>
        </aside>
      </div>
    </Show>
  );
}

function SidePanel() {
  const player = usePlayer();
  const lyricsShown = () => sideLyrics() && player.current() !== null;
  const open = () => player.queueOpen() || lyricsShown();

  return (
    <aside
      class={cn(
        "flex shrink-0 flex-col overflow-hidden transition-[width] duration-200 ease-out",
        open()
          ? "glass-bar glass-inset w-[22rem] border-l md:mb-[var(--player-space,0px)] border-border/60 bg-card/25"
          : "w-0 border-l-0",
      )}
      inert={open() ? undefined : true}
      aria-label={t("player.queue")}
    >
      <Show
        when={lyricsShown()}
        fallback={
          <Show when={player.queueOpen()}>
            <QueueList />
          </Show>
        }
      >
        <div
          class="side-column h-full w-[22rem] max-w-[92vw]"
          data-queue={player.queueOpen() ? "open" : "closed"}
        >
          <SideLyrics />
          <div
            class="side-queue min-h-0 overflow-hidden border-t border-border/60"
            inert={player.queueOpen() ? undefined : true}
          >
            <Show when={player.queueOpen()}>
              <QueueList />
            </Show>
          </div>
        </div>
      </Show>
    </aside>
  );
}

function SideLyrics() {
  const player = usePlayer();

  return (
    <section
      class="flex min-h-0 flex-col overflow-hidden"
      aria-label={t("player.lyrics")}
    >
      <div class="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4">
        <div class="flex items-center gap-2">
          <MicVocal class="size-4 text-muted-foreground" />
          <h2 class="text-sm font-semibold">{t("player.lyrics")}</h2>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => player.toggleLyrics()}
          title={t("player.nowPlaying")}
          aria-label={t("player.nowPlaying")}
        >
          <Maximize2 class="size-4" />
        </Button>
      </div>
      <div class="flex min-h-0 flex-1 flex-col">
        <Show when={player.current()}>
          {(song) => (
            <LyricsPanel
              song={song()}
              active={!player.nowPlayingOpen()}
              compact
            />
          )}
        </Show>
      </div>
    </section>
  );
}

function QueueList(props: { class?: string }) {
  const player = usePlayer();

  return (
    <div class={cn("flex h-full w-[22rem] max-w-[92vw] flex-col", props.class)}>
      <div class="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4">
        <div class="flex items-center gap-2">
          <ListMusic class="size-4 text-muted-foreground" />
          <h2 class="text-sm font-semibold">{t("player.queue")}</h2>
          <span class="text-xs text-muted-foreground">
            {player.state.queue.length}
          </span>
        </div>
        <div class="flex items-center gap-1">
          <Show when={player.state.queue.length > 0}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => player.clearQueue()}
            >
              {t("player.clearQueue")}
            </Button>
          </Show>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => player.setQueueOpen(false)}
            aria-label={t("action.close")}
          >
            <X class="size-4" />
          </Button>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-2">
        <Show
          when={player.state.queue.length > 0}
          fallback={
            <EmptyState
              icon={<ListMusic class="size-5" />}
              title={t("player.queueEmpty")}
              description={t("player.queueEmptyHint")}
              class="mt-6 border-none"
            />
          }
        >
          <VirtualList items={player.state.queue} estimateSize={48}>
            {(song, index) => {
              const isCurrent = () => index === player.state.index;
              return (
                <div
                  class={cn(
                    "group flex items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-accent/60",
                    isCurrent() && "bg-accent/50",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => player.jumpTo(index)}
                    class="relative size-9 shrink-0 overflow-hidden rounded"
                    aria-label={t("action.play")}
                  >
                    <Cover
                      coverArtId={song.coverArt}
                      size={64}
                      alt={song.album ?? song.title}
                      class="size-9 rounded"
                    />
                    <Show when={isCurrent()}>
                      <span class="absolute inset-0 flex items-center justify-center bg-black/55">
                        <PlayingBars paused={!player.state.playing} />
                      </span>
                    </Show>
                  </button>
                  <button
                    type="button"
                    onClick={() => player.jumpTo(index)}
                    class="min-w-0 flex-1 text-left"
                  >
                    <p
                      class={cn(
                        "truncate text-xs font-medium",
                        isCurrent() && "text-primary",
                      )}
                    >
                      {song.title}
                    </p>
                    <p class="truncate text-[11px] text-muted-foreground">
                      {song.artist ?? t("common.unknownArtist")}
                    </p>
                  </button>
                  <span class="text-[11px] tabular-nums text-muted-foreground">
                    {formatTime(song.duration)}
                  </span>
                  <button
                    type="button"
                    // Touch screens have no hover, so phones always show it.
                    class="rounded p-1 text-muted-foreground opacity-0 transition-colors hover:text-destructive group-hover:opacity-100 max-md:opacity-100"
                    onClick={() => player.removeAt(index)}
                    aria-label={t("player.remove")}
                  >
                    <Trash2 class="size-3.5" />
                  </button>
                </div>
              );
            }}
          </VirtualList>
        </Show>
        <Show when={player.radioLoading()}>
          <div role="status" aria-live="polite">
            <div class="flex items-center gap-2 px-1.5 pb-1 pt-3 text-xs text-muted-foreground">
              <LoaderCircle class="size-3.5 animate-spin text-primary" />
              {t("radio.loading")}
            </div>
            <For each={[0, 1, 2, 3]}>
              {(row) => (
                <div
                  class="flex animate-pulse items-center gap-2.5 px-1.5 py-1.5"
                  style={{ "animation-delay": `${row * 150}ms` }}
                >
                  <div class="size-9 shrink-0 rounded bg-muted" />
                  <div class="flex-1 space-y-1.5">
                    <div class="h-2.5 w-3/4 rounded bg-muted" />
                    <div class="h-2 w-1/2 rounded bg-muted/70" />
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
}
