import { For, Show } from "solid-js";
import { ListMusic, LoaderCircle, Trash2, X } from "lucide-solid";
import { usePlayer } from "~/player/store";
import { t } from "~/i18n";
import { formatTime } from "~/lib/format";
import { cn } from "~/lib/utils";
import { Cover, EmptyState, PlayingBars } from "~/components/common";
import { Button } from "~/components/ui/button";

export function QueuePanel() {
  const player = usePlayer();

  return (
    <aside
      class={cn(
        "flex shrink-0 flex-col overflow-hidden transition-[width] duration-200 ease-out",
        player.queueOpen()
          ? "glass-bar glass-inset w-[22rem] border-l md:mb-[var(--player-space,0px)] border-border/60 bg-card/25 max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-40 max-md:max-w-[92vw] max-md:bg-card max-md:shadow-2xl"
          : "w-0 border-l-0",
      )}
      inert={player.queueOpen() ? undefined : true}
      aria-label={t("player.queue")}
    >
      <div class="flex h-full w-[22rem] max-w-[92vw] flex-col">
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
            <For each={player.state.queue}>
              {(song, index) => {
                const isCurrent = () => index() === player.state.index;
                return (
                  <div
                    class={cn(
                      "group flex items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-accent/60",
                      isCurrent() && "bg-accent/50",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => player.jumpTo(index())}
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
                      onClick={() => player.jumpTo(index())}
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
                      class="rounded p-1 text-muted-foreground opacity-0 transition-colors hover:text-destructive group-hover:opacity-100"
                      onClick={() => player.removeAt(index())}
                      aria-label={t("player.remove")}
                    >
                      <Trash2 class="size-3.5" />
                    </button>
                  </div>
                );
              }}
            </For>
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
    </aside>
  );
}
